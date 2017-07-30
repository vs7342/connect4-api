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
}