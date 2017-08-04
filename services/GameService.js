/**
 * Endpoints/Services related to the actual game logic:
 *      Challenging a player
 *      Actual playing of game
 *      Heartbeats
 */

//Node modules
var validator = require('validator');
var crypto = require('crypto');

//Custom modules - Sequelize models and helper module
var model_user = require('../models/User');
var model_room = require('../models/Room');
var model_lookup_room = require('../models/Lookup_RoomType');
var model_game = require('../models/Game');
var model_player = require('../models/Player');
var model_piece = require('../models/Piece');
var model_challenge = require('../models/Challenge');
var my_seq = require('../models/MySeq');
var helper = require('../helper');

/**
 * @author: Vidit Singhal
 * @description: This will fetch all the ongoing games(Along with the players playing that game). It will also fetch online players not in a game.
 * @param: (Query Param)
 *      Room_id
 *      User_id
 * @returns: 
 *      {
            ongoing_games: Array of Games{id, Array of Players{id, Room_id, User_id, Game_id, User{id, Screen_Name}}},
            available_players: Array of {id, Screen_Name}
        }
 */
function getRoomDetails(req, res){
    //query params
    var Room_id = req.query.Room_id;
    var User_id = req.query.User_id;
    //param check
    if(Room_id && User_id){
        //only process if the user is inside the room
        model_user.findAndCountAll({
            where:{
                id: User_id,
                Room_id: Room_id
            }
        }).then(result=>{
            if(result.count==1){
                //We are now sure that user is inside the room
                //First find all the games going on along with the players inside those games
                model_game.hasMany(model_player, {foreignKey: 'Game_id'});
                model_player.belongsTo(model_user, {foreignKey: 'User_id'});
                model_game.findAll({
                    attributes:['id'],
                    where:{
                        Is_Finished: false,
                        Room_id: Room_id
                    },
                    include:[{
                        model: model_player,
                        attributes: ['Room_id', 'User_id', 'id', 'Game_id'],
                        include: [{
                            model: model_user,
                            attributes: ['id', 'Screen_Name']
                        }]
                    }]
                }).then(ongoing_games=>{
                    //We now have all the games going on
                    
                    //Extract all the players from all the games and put those inside an array
                    //We need this list since we don't want the players inside a game getting challenged
                    var players_in_game = [];
                    for(var i=0; i<ongoing_games.length; i++){
                        players_in_game.push(ongoing_games[i].Players[0].User_id);
                        players_in_game.push(ongoing_games[i].Players[1].User_id);
                    }

                    //Put the requesting user as well in this list so that we can use a 'not equal to' constraint
                    players_in_game.push(User_id);

                    //We now fetch all the players inside the room and who are not inside any games
                    model_user.findAll({
                        attributes: ['id', 'Screen_Name'],
                        where:{
                            $and:{
                                Room_id: Room_id,
                                id:{ 
                                    $notIn: players_in_game 
                                }
                            }
                        }
                    }).then(available_players=>{
                        //We now have everything needed in the response
                        var custom_response = {
                            ongoing_games: ongoing_games,
                            available_players: available_players
                        }
                        return res.status(200).send(custom_response);
                    }).catch(error=>{
                        return res.status(500).send(helper.getResponseObject(false, 'Error ecountered. Code 3.'));
                    })
                }).catch(error=>{
                    return res.status(500).send(helper.getResponseObject(false, 'Error ecountered. Code 2.'));
                })
            }else{
                return res.status(500).send(helper.getResponseObject(false, 'User not found or not inside the room.'));
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error ecountered. Code 1.'));
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Creates a challenge object. Constraint - Both players should be inside the same room and not in an ongoing game. Also there should not be any ongoing challenge between them.
 * @param: (Body Param)
 *      From_User_id
 *      To_User_id
 * @returns: 
 *      If challenge already exists between those two users..then that challenge will be returned
 *      Else challenge will be created and returned
 *      Response will look like:
 *      {
 *          "success": true/false, (true when challenge is created/false when existing challenge was found)
 *          "message": message,
 *          "data": challenge object if created / array of challenges if any existing were found
 *      }
 */
function challengePlayer(req, res){
    //body params
    var From_User_id = req.body.From_User_id;
    var To_User_id = req.body.To_User_id;
    //param check
    if(From_User_id && To_User_id){
        //First - check if both players are in the same room
        model_user.findAll({
            where:{
                id:{
                    $in: [From_User_id, To_User_id]
                }
            }
        }).then(both_users=>{
            if(both_users.length == 2){
                if(both_users[0].Room_id == both_users[1].Room_id){
                    //Second - check if both players are not in an ongoing game
                    model_game.findAll({
                        where:{
                            Room_id: both_users[0].Room_id,
                            Is_Finished: false
                        }
                    }).then(ongoing_games=>{
                        //gather all the players inside the ongoing games
                        var players_in_game = [];
                        for(var i=0; i<ongoing_games.length; i++){
                            players_in_game.push(ongoing_games[i].Players[0].User_id);
                            players_in_game.push(ongoing_games[i].Players[1].User_id);
                        }
                        //now loop through the players in game and check with the from and to user id
                        for(var j=0; j<players_in_game.length; j++){
                            if(players_in_game[j]==From_User_id || players_in_game[j]==To_User_id){
                                return res.status(500).send(helper.getResponseObject(false, 'Cannot challenge since either or both the players are playing a game.'));
                            }
                        }

                        //Find any ongoing challenge between the requested users
                        model_challenge.findAll({
                            where:{
                                $or:[{
                                    $and:{
                                        From_User_id: From_User_id,
                                        To_User_id: To_User_id,
                                        Accepted: null,
                                        Cancelled: false,
                                        Expired: false
                                    }
                                },{
                                    $and:{
                                        From_User_id: To_User_id,
                                        To_User_id: From_User_id,
                                        Accepted: null,
                                        Cancelled: false,
                                        Expired: false
                                    }
                                }]
                            },
                            raw: false
                        }).then(ongoing_chals_between_users=>{
                            if(ongoing_chals_between_users.length==0){
                                //If the code reaches here, then the users are all set
                                //Finally create a challenge object with Accepted, Cancelled and Expired as 'false'
                                model_challenge.create({
                                    From_User_id: From_User_id,
                                    To_User_id: To_User_id,
                                    Created_At: Date.now(),
                                    Accepted: null,
                                    Cancelled: false,
                                    Expired: false
                                }).then(created_challenge=>{
                                    //Send the created challenge to user with status 200 and success:true
                                    var return_obj = helper.getResponseObject(true, 'Challenge created successfully.');
                                    return_obj.data = created_challenge;
                                    return res.status(200).send(return_obj);
                                }).catch(error=>{
                                    return res.status(500).send(helper.getResponseObject(false, 'Error challenging player. Code 4.'));
                                })
                            }else{
                                //Send the ongoing challenge to user with status 200 but and success:false
                                var return_obj = helper.getResponseObject(false, 'Challenge already exists.');
                                return_obj.data = ongoing_chals_between_users;
                                return res.status(200).send(return_obj);
                            }
                        }).catch(error=>{
                            return res.status(500).send(helper.getResponseObject(false, 'Error challenging player. Code 3.'));
                        })
                    }).catch(error=>{
                        return res.status(500).send(helper.getResponseObject(false, 'Error challenging player. Code 2.'));
                    })
                }else{
                    return res.status(500).send(helper.getResponseObject(false, 'Both the users must be inside the same room.'));
                }
            }else{
                return res.status(500).send(helper.getResponseObject(false, 'User(s) not found.'));
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error challenging player. Code 1.'));
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Updates the challenge object with (Accepted : true) only if that challenge is not Expired/Cancelled/Completed.
 *               Maybe initialize the game..(Not yet implemeted)
 * @param: (Body Param)
 *      Challenge_id
 * @returns: 
 *      whether the request was successful or not
 */
function acceptChallenge(req, res){
    //body params
    var Challenge_id = req.body.Challenge_id;
    //param check
    if(Challenge_id){
        //Set Accepted = 'true' only if that challenge is not Expired/Cancelled/Completed
        model_challenge.update({
            Accepted: true
        },{
            where:{
                id: Challenge_id,
                Expired: false,
                Cancelled: false,
                Accepted: null
            }
        }).then(update_result=>{
            if(update_result[0]){
                return res.status(200).send(helper.getResponseObject(true, 'Challenge accepted.'));
            }else{
                return res.status(500).send(helper.getResponseObject(false, 'Challenge not found or already expired/cancelled/completed.'));
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error accepting challenge. Code 1.'));
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Updates the challenge object with (Cancelled: true) only if that challenge is not Accepted/Declined/Expired.
 * @param: (Body Param)
 *      Challenge_id
 * @returns: 
 *      whether the request was successful or not
 */
function cancelChallenge(req, res){
    //body params
    var Challenge_id = req.body.Challenge_id;
    //param check
    if(Challenge_id){
        //Set Cancelled = true if that challenge is not Accepted/Expired
        model_challenge.update({
            Cancelled: true
        },{
            where:{
                id: Challenge_id,
                Accepted: null, //This means that the challenge is not complete - i.e. not accepted/declined
                Expired: false,
                Cancelled: false
            }
        }).then(update_result=>{
            if(update_result[0]){
                return res.status(200).send(helper.getResponseObject(true, 'Challenge cancelled.'));
            }else{
                return res.status(500).send(helper.getResponseObject(false, 'Challenge not found or already Accepted/Expired/Cancelled.'));
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error accepting challenge. Code 1.'));
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Updates the challenge object with (Accepted : false) only if that challenge is not Expired/Cancelled/Completed.
 * @param: (Body Param)
 *      Challenge_id
 * @returns: 
 *      whether the request was successful or not
 */
function declineChallenge(req, res){
    //body params
    var Challenge_id = req.body.Challenge_id;
    //param check
    if(Challenge_id){
        //Set Accepted = false only if that challenge is not Expired/Cancelled/Completed
        model_challenge.update({
            Accepted: false
        },{
            where:{
                id: Challenge_id,
                Expired: false,
                Cancelled: false,
                Accepted: null
            }
        }).then(update_result=>{
            if(update_result[0]){
                return res.status(200).send(helper.getResponseObject(true, 'Challenge declined.'));
            }else{
                return res.status(500).send(helper.getResponseObject(false, 'Challenge not found or already Cancelled/Expired/Completed.'));
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error accepting challenge. Code 1.'));
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: --Heartbeat-- 
 *               Checks for incoming challenge for a player inside the room
 *               Fetch challenges targeted to a specific player and which are not yet completed(accepted/declined)/cancelled/expired
 * @param: (Query Param)
 *      To_User_id
 * @returns: 
 *      Array of Challenge objects
 */
function incomingChallengesHB(req, res){
    //query params
    var To_User_id = req.query.To_User_id;
    //param check
    if(To_User_id){
        //fetch incoming challenges
        model_challenge.findAll({
            where:{
                To_User_id: To_User_id,
                Accepted: null,
                Cancelled: false,
                Expired: false
            }
        }).then(result=>{
            return res.status(200).send(result);
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error fetching challenges.'));
        });
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: --Heartbeat-- 
 *               After a player challenges another player, a challenge will expire after 30 seconds.
 *               In those 30 seconds, there will be kind of a constant check whether the challenge was accepted/declined/cancelled/expired
 *               This is basically a get challenge call
 * @param: (Query Param)
 *      Challenge_id
 * @returns: 
 *      Challenge object
 */
function ongoingChallengeHB(req, res){
    //query param
    var Challenge_id = req.query.Challenge_id;
    //param check
    if(Challenge_id){
        //fetch the challenge
        model_challenge.findOne({
            where:{
                id: Challenge_id
            }
        }).then(result=>{
            return res.status(200).send(result);
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error fetching challenge.'));
        });
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Initializes game and player(s) objects based on challenge id
 *               Challenge should be accepted
 * @param: (Body Param)
 *      Challenge_id
 * @returns: 
 *      {
 *          'Game':{Game Object},
 *          'Players':[Array of Player Objects]
 *      }
 */
function initGame(req, res){
    //body param
    var Challenge_id = req.body.Challenge_id;
    //param check
    if(Challenge_id){
        //fetch challenge details along with user details
        model_challenge.belongsTo(model_user, {as: 'From_User', foreignKey: 'From_User_id'});
        model_challenge.belongsTo(model_user, {as: 'To_User', foreignKey: 'To_User_id'});
        model_challenge.findOne({
            where:{
                id: Challenge_id
            },
            include:[{
                model: model_user, as: 'From_User'
            },{
                model: model_user, as: 'To_User'
            }]
        }).then(challenge_found=>{
            if(challenge_found){
                //check if the challenge is valid..accepted..not expired..not cancelled
                if(challenge_found.Accepted == true && challenge_found.Cancelled == false && challenge_found.Expired == false && challenge_found.From_User.Room_id == challenge_found.To_User.Room_id){
                    //Create game object
                    model_game.create({
                        Is_Finished: false,
                        Start_Time: Date.now(),
                        End_Time: null,
                        Room_id: challenge_found.From_User.Room_id
                    }).then(created_game=>{
                        //Create the player objects
                        //Challenger will be having first turn..and the color assigned would be red
                        var challenger = {
                            Has_Turn: true,
                            Is_Challenger: true,
                            Is_Winner: null,
                            Color: 'Red',
                            Last_Played: Date.now(),
                            Game_id: created_game.id,
                            Room_id: challenge_found.From_User.Room_id,
                            User_id: challenge_found.From_User.id
                        };
                        //Challengee will have 'yellow' color assigned
                        var challengee = {
                            Has_Turn: false,
                            Is_Challenger: false,
                            Is_Winner: null,
                            Color: 'Yellow',
                            Last_Played: Date.now(),
                            Game_id: created_game.id,
                            Room_id: challenge_found.To_User.Room_id,
                            User_id: challenge_found.To_User.id
                        };

                        //Bulk insert into db
                        model_player.bulkCreate(
                            [challenger, challengee]
                        ).then((created_players)=>{
                            return res.status(200).send({
                                Game: created_game,
                                Players: created_players 
                            });
                        }).catch(error=>{
                            return res.status(500).send(helper.getResponseObject(false, 'Error initializing players. Code 1.'));
                        });
                    }).catch(error=>{
                        return res.status(500).send(helper.getResponseObject(false, 'Error initializing game. Code 2.'));
                    })
                }else{
                    return res.status(500).send(helper.getResponseObject(false, 'Invalid Challenge.'));
                }
            }else{
                return res.status(400).send(helper.getResponseObject(false, 'Challenge not found.'));
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error initializing game. Code 1.'));
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Validates everything before posting the piece in DB
 *              After validating..postPieceTransaction() is called which the heart of postPiece endpoint
 * @param: (Body Param)
 *      Position_X
 *      Player_id
 *      Game_id
 *      Room_id
 *      User_id
 * @returns: 
 *      {
 *           Is_Game_Finished: true/false,
 *           Winner_Player_Id: -1 (If Game in progress) / 0 (If Draw) / Winner player id (If Winner found)
 *           Winner_User_Id: -1 (If Game in progress) / 0 (If Draw) / Winner user id (If Winner found)
 *       }
 */
function postPiece(req, res){
    //body params
    var Position_X = req.body.Position_X;
    var Player_id = req.body.Player_id;
    var Game_id = req.body.Game_id;
    var Room_id = req.body.Room_id;
    var User_id = req.body.User_id;
    //param check
    if(Position_X!=undefined && Player_id && Game_id && Room_id && User_id){
        //first check if the co-ordinates of piece are in range
        if(Position_X >= 0 && Position_X <= 6){
            //check if the game is not already finished
            model_game.findOne({
                where:{
                    id: Game_id,
                    Room_id: Room_id,
                    Is_Finished: false
                }
            }).then(game_found=>{
                if(game_found){
                    //So the game is valid
                    //Now validate the player's turn
                    model_player.findOne({
                        where:{
                            Has_Turn: true,
                            id: Player_id,
                            Game_id: Game_id,
                            Room_id: Room_id,
                            User_id: User_id
                        }
                    }).then(player_valid=>{
                        if(player_valid){
                            //Now check for the rest of the pieces in the game and determine the Position_Y for this piece
                            model_piece.findAll({
                                where:{
                                    Game_id: Game_id,
                                    Room_id: Room_id,
                                    User_id: User_id
                                }
                            }).then(all_pieces_in_game=>{
                                
                                //Now check if there is space on game board - max num of pieces in game is 42
                                var num_pieces_in_game = all_pieces_in_game.length;
                                if(num_pieces_in_game<42){

                                    //Now extract num of pieces in that column and determine y position
                                    var single_col_pieces = 0;
                                    for(var i=0; i<num_pieces_in_game; i++){
                                        var single_piece = all_pieces_in_game[i];
                                        if(single_piece!=undefined && single_piece.Position_X == Position_X){
                                            single_col_pieces++;
                                        }
                                    }

                                    //Position_Y is nothing but number of pieces in that column
                                    var calculated_position_y = single_col_pieces;

                                    //Check for boundary limits
                                    if(calculated_position_y > 5){
                                        return res.status(400).send(helper.getResponseObject(false, 'Piece co-ordinates outside Y boundary.'));
                                    }

                                    //All the validations were done
                                    //Finally start post piece transaction
                                    return postPieceTransaction(req, res, calculated_position_y, num_pieces_in_game);
                                }else{
                                    return res.status(400).send(helper.getResponseObject(false, 'Game board full. Cannot insert any more pieces.'));
                                }
                            }).catch(error=>{
                                return res.status(500).send(helper.getResponseObject(false, 'Error posting piece validation. Code 3.'));
                            })
                        }else{
                            return res.status(400).send(helper.getResponseObject(false, 'Player not found / Not this player\'s turn.'));
                        }
                    }).catch(error=>{
                        return res.status(500).send(helper.getResponseObject(false, 'Error posting piece validation. Code 2.'));
                    })
                }else{
                    return res.status(400).send(helper.getResponseObject(false, 'Game not found/already finished.'));
                }
            }).catch(error=>{
                return res.status(500).send(helper.getResponseObject(false, 'Error posting piece validation. Code 1.'));
            })
        }else{
            return res.status(400).send(helper.getResponseObject(false, 'Piece co-ordinates outside X boundary.'));
        }
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters.'));
    }
}

//Direction dictionary
const directions = [
    {x: -1, y: +1}, //NW
    {x: -1, y:  0}, //W
    {x: -1, y: -1}, //SW
    {x:  0, y: -1}, //S
    {x: +1, y: -1}, //SE
    {x: +1, y:  0}, //E
    {x: +1, y: +1}, //NE
];

/**
 * @author: Vidit Singhal
 * @description: The MAIN LOGIC of game API - 
 *      1. Posts a piece.. updates relevant info in db
 *      2. If winner was not found..and game board is not full..game can continue
 *      3. If winner was not found..and game board is full..DRAW condition encountered
 *      4. If winner was found..updates relevant info in db
 * @param {*} req Request object for the postPiece endpoint
 * @param {*} res Response object for the postPiece endpoint
 * @param {*} Position_Y Calculated Y position (since it was calculated already during validations performed in postPiece endpoint)
 * @param {*} pieces_in_game_before_piece_post number of pieces in game before posting piece (since it was calculated already during validations performed in postPiece endpoint)
 */
function postPieceTransaction(req, res, Position_Y, pieces_in_game_before_piece_post){
    //Extract turn related info from request object
    var Position_X = req.body.Position_X;
    var Player_id = req.body.Player_id;
    var Game_id = req.body.Game_id;
    var Room_id = req.body.Room_id;
    var User_id = req.body.User_id;

    //default values - preparing for response object
    var Is_Game_Finished = false;
    var Winner_Player_Id = -1;
    var Winner_User_Id = -1;

    model_piece.findAll({
        where:{
            Player_id: Player_id,
            Game_id: Game_id
        },
        attributes:['Position_X', 'Position_Y']
    }).then(all_pieces=>{
        //Start with the transaction which will do following things:
        //1. Create a piece
        //2. Update Current player Has_Turn attribute to false AND update Last_Played attr
        //3. Update Opponent Player Has_Turn attribute to true
        //4. Check for all the pieces for the current player and determine if he won or not
        //If Winner not found
            //If board is not full - game is still on!
                //5. Commit the transaction (1-4) and return response
            //If board is full - DRAW condition
                //6. Update Game object - Is_Finished, End_Time
                //7. Update Current Player object - Is_Winner
                //8. Update Opponent object - Is_Winner
                //9. Commit the transaction (1-4, 6-8)
        //If Winner found then :
            //10.  Update Game object - Is_Finished, End_Time
            //11. Update Winner Player object - Is_Winner
            //12. Update Loser Player object - Is_Winner    
            //13. Commit the transaction (1-4, 10-12)                          
        my_seq.transaction(function(my_transaction){
            
            var promises = [];
            //1. Creating piece
            promises.push( 
                model_piece.create({
                    Position_X: Position_X,
                    Position_Y: Position_Y,
                    Player_id: Player_id,
                    Game_id: Game_id,
                    Room_id: Room_id,
                    User_id: User_id
                },{
                    transaction: my_transaction
                })
            );

            //2. Update current player Has_Turn and Last_Played attribute
            promises.push(
                    model_player.update({
                    Has_Turn: false,
                    Last_Played: Date.now()
                },{
                    where: {
                        id: Player_id
                    },
                    transaction: my_transaction
                })
            );

            //3. Now update opponent player turn attribute
            promises.push(
                    model_player.update({
                    Has_Turn: true
                },{
                    where:{
                        id:{ $ne: Player_id },
                        Game_id: Game_id,
                        Room_id: Room_id
                    },
                    transaction: my_transaction
                })
            );
            
            //4. Now check for all the pieces for the current player and determine if he won or not
            //If there are less than 4 pieces, no need to check since game is definetly not finished
            if(all_pieces.length >= 4){
                //navigate to all directions from (Position_X, Position_Y)
                for(var i = 0; i < 7; i++){
                    //reset to the given position (starting point)
                    var current_x = Position_X;
                    var current_y = Position_Y;
                    
                    //Set the connected points to 1
                    var connected = 1;
                    
                    //start travelling to a single direction
                    while(connected < 4){
                        //go to next point
                        current_x = current_x + directions[i].x;
                        current_y = current_y + directions[i].y;
                        
                        //check for game board boundaries
                        if(current_x < 0 || current_x > 6 || current_y < 0 || current_y > 5){
                            //skip to next direction since boundary was crossed
                            break;
                        }

                        //check if a piece exists in that co-ordinate
                        if(isPiecePresent(all_pieces, current_x, current_y)){
                            //we found a piece..increment the counter
                            connected++;
                        }else{
                            //since the piece is not present, we can skip to next direction
                            break;
                        }
                    }

                    //control will reach here on 3 conditions - piece was not found / connected = 4 / crossed the boundary
                    if(connected == 4){
                        Is_Game_Finished = true;
                        break;
                    }
                }
            }

            //control will reach here on 2 conditions - 4 or more pieces were found / all directions were traversed
            //If game is not finished, we can commit the transaction and return the response to user
            //If game is finished, then we have to update player and game object in db
            if(!Is_Game_Finished){

                //Check if number of pieces before posting is less than 41
                if(pieces_in_game_before_piece_post < 41){
                    //5. commit since game is not finished yet and winner was not found
                    return my_seq.Promise.all(promises);
                }else{
                    //Since before posting piece..count was 41..and winner was not found
                    //Draw condition encountered since the game board is full
                    //6. Update Game object - Is_Finished, End_Time
                    promises.push(
                        model_game.update({
                            Is_Finished: true,
                            End_Time: Date.now()
                        },{
                            where:{
                                id: Game_id,
                                Room_id: Room_id
                            },
                            transaction: my_transaction
                        })
                    );
                                    
                    //7. Update current Player object - Is_Winner 
                    promises.push(
                        model_player.update({
                            Is_Winner: false
                        },{
                            where:{
                                id: Player_id,
                                Game_id: Game_id
                            },
                            transaction: my_transaction
                        })
                    );

                    //8. Update opponent Player object - Is_Winner  
                    promises.push(
                        model_player.update({
                            Is_Winner: false
                        },{
                            where:{
                                id:{ $ne: Player_id },
                                Game_id: Game_id,
                                Room_id: Room_id
                            },
                            transaction: my_transaction
                        })
                    );

                    //Update response object attributes
                    Winner_Player_Id = 0;
                    Winner_User_Id = 0;

                    //9. Finally commit transactions 1-4, 6-8
                    return my_seq.Promise.all(promises);
                }
            }else{

                //10. Update Game object - Is_Finished, End_Time
                promises.push(
                    model_game.update({
                        Is_Finished: true,
                        End_Time: Date.now()
                    },{
                        where:{
                            id: Game_id,
                            Room_id: Room_id
                        },
                        transaction: my_transaction
                    })
                );
                                
                //11. Update Winner Player object - Is_Winner 
                promises.push(
                    model_player.update({
                        Is_Winner: true
                    },{
                        where:{
                            id: Player_id,
                            Game_id: Game_id
                        },
                        transaction: my_transaction
                    })
                );

                //12. Update Loser Player object - Is_Winner  
                promises.push(
                    model_player.update({
                        Is_Winner: false
                    },{
                        where:{
                            id:{ $ne: Player_id },
                            Game_id: Game_id,
                            Room_id: Room_id
                        },
                        transaction: my_transaction
                    })
                );

                //Update response object attributes
                Winner_Player_Id = Player_id;
                Winner_User_Id = User_id;

                //13. Finally commit transactions 1-4, 10-12
                return my_seq.Promise.all(promises);
            }
        }).then(result=>{
            return res.status(200).send({
                Is_Game_Finished: Is_Game_Finished,
                Winner_Player_Id: Winner_Player_Id,
                Winner_User_Id: Winner_User_Id
            });
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error posting piece. Code 2.'));
        })
    }).catch(error=>{
        return res.status(500).send(helper.getResponseObject(false, 'Error posting piece. Code 1.'));
    })
}

/**
 * @author: Vidit Singhal
 * @description: Checks from an array of pieces if it is present in the given (x,y) coordinate
 * @param {*} all_pieces Array of all pieces
 * @param {*} position_x x co-ordinate of location to check
 * @param {*} position_y y co-ordinate of location to check
 * @returns: 
 */
function isPiecePresent(all_pieces, position_x, position_y){
    var piece_count = all_pieces.length;
    var piece_found = false;
    for(var i = 0; i < piece_count; i++){
        var single_piece = all_pieces[i];
        if(single_piece.Position_X == position_x && single_piece.Position_Y == position_y){
            piece_found = true;
            break;
        }
    }
    return piece_found;
}

//Making available the endpoints outside the module.
module.exports = {
    //After the player is inside a room, room details are required
    getRoomDetails: getRoomDetails,

    //Challenge related normal api calls
    challengePlayer: challengePlayer,
    acceptChallenge: acceptChallenge,
    cancelChallenge: cancelChallenge,
    declineChallenge: declineChallenge,

    //Heart beats - listen to incoming challenges / ongoing challenge
    incomingChallengesHB: incomingChallengesHB,
    ongoingChallengeHB: ongoingChallengeHB,

    //Game related endpoints
    initGame: initGame,
    postPiece: postPiece
}