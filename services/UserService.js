/**
 * Endpoints/Services related to User object
 */

//Node modules
var validator = require('validator');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');

//Custom modules
var model_user = require('../models/User');
var model_room = require('../models/Room');
var model_lookup_room = require('../models/Lookup_RoomType');
var helper = require('../helper');

//Secret key to hash the password
const secret_key = "I have trust issues!";

//Fetching secret for jwt
var config_file_name = '../configs/' + helper.ENVIRONMENT + '.json';
const jwt_secret = require(config_file_name).JwtSecret;

/**
 * @author: Vidit Singhal
 * @description: Endpoint for user signup
 * @param: (Body params)
 *      Email_id
 *      First_Name
 *      Last_Name
 *      Screen_Name
 *      Password
 */
function signup(req, res){
    //body params
    var Email_id = req.body.Email_id;
    var First_Name = req.body.First_Name;
    var Last_Name = req.body.Last_Name;
    var Screen_Name = req.body.Screen_Name;
    var Password = req.body.Password;
    //param check
    if(Email_id && First_Name && Last_Name && Screen_Name && Password){

        //Validate all the inputs
        var err_msg = "Invalid inputs for : ";
        var isValid = true;
        if(!validator.isEmail(Email_id)){
            isValid = false;
            err_msg += "Email id,";
        }
        if(!validator.isAlpha(First_Name)){
            isValid = false;
            err_msg += "First Name,";
        }
        if(!validator.isAlpha(Last_Name)){
            isValid = false;
            err_msg += "Last Name,";
        }
        if(!validator.isAlphanumeric(Screen_Name)){
            isValid = false;
            err_msg += "Screen Name,";
        }

        //Return if input is not valid
        if(!isValid){
            err_msg = err_msg.slice(0, -1);
            return res.status(200).send(helper.getResponseObject(false, err_msg));
        }

        //Check for existing Email ID or Screen_Name
        model_user.findAll({
            where:{
                $or:[
                        { Email_id: Email_id },
                        { Screen_Name: Screen_Name }
                ]
            }
        }).then(user_found=>{
            if(user_found.length>0){
                return res.status(500).send(helper.getResponseObject(false, 'Email ID and/or Screen Name already in use.'));
            }else{
                //User not found..We can proceed with user creation/signup
                //Hash the password
                var hashed_pwd = crypto.createHmac('sha256', secret_key)
                                    .update(Password)
                                    .digest('hex');

                //Create the entry in DB
                model_user.create({
                    Email_id: Email_id,
                    First_Name: First_Name,
                    Last_Name: Last_Name,
                    Screen_Name: Screen_Name,
                    Password: hashed_pwd,
                    Win_Count: 0,
                    Games_Played: 0,
                    User_Since: Date.now(),
                    Experience: 0,
                    Room_id: 1
                }).then(created_user=>{
                    return res.status(200).send({
                        success: true,
                        token: getJWT({
                            id: created_user.id,
                            Email_id: created_user.Email_id,
                            First_Name: created_user.First_Name,
                            Last_Name: created_user.Last_Name,
                            Screen_Name: created_user.Screen_Name,
                            Win_Count: created_user.Win_Count,
                            Games_Played: created_user.Games_Played,
                            User_Since: created_user.User_Since,
                            Experience: created_user.Experience,
                            Room_id: created_user.Room_id
                        })
                    });
                }).catch(error=>{
                    return res.status(500).send(helper.getResponseObject(false, 'Error signing up. Code 2.'));
                })
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error signing up. Code 1.'));
        });
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Endpoint for user login
 * @param: (Body params)
 *      Email_id
 *      Password
 * @returns: 
 *      Response will consist of basic user details - id, Win_Count, Games_Played, User_Since, Experience and Room_id
 */
function login(req, res){
    //body params
    var Email_id = req.body.Email_id;
    var Password = req.body.Password;
    //param check
    if(Email_id && Password){
        //Hash the password
        var hashed_pwd = crypto.createHmac('sha256', secret_key)
                                    .update(Password)
                                    .digest('hex');
        
        //Find the user with the given password and email id
        model_user.findOne({
            attributes:{ exclude: ['Password'] },
            where:{
                Email_id: Email_id,
                Password: hashed_pwd
            }
        }).then(user_found=>{
            if(user_found){
                //Enter room with ID = 1 since when a user logs in, he enters into the lobby
                model_user.update({
                    Room_id: 1
                },{
                    where: {
                        id: user_found.id
                    }
                }).then(result=>{
                    //Since the user_found variable has the older Room_id value, change it.. since it is already updated in the backend
                    user_found.Room_id = 1;

                    return res.status(200).send({success: true, token: getJWT(user_found.dataValues)});
                }).catch(error=>{
                    return res.status(500).send(helper.getResponseObject(false, 'Error logging in. Code 2.'));
                });
            }else{
                return res.status(200).send(helper.getResponseObject(false, 'Invalid username and/or password.'));
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error logging in.'));
        });
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

function getJWT(payload){
    //Setting expiry date to current + 7 days
    var expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);

    //Add the expiry date in the payload
    payload['exp'] = parseInt(expiry.getTime() / 1000);

    //Finally generate the signed token and return
    return jwt.sign(payload, jwt_secret);
}

/**
 * @author: Vidit Singhal
 * @description: Endpoint for screen name availability check
 * @param: (Query param)
 *      Screen_Name
 * @returns: 
 *      Response will look like: {available: true/false}
 */
function checkScreenName(req, res){
    //query param
    var Screen_Name = req.query.Screen_Name;
    //param check
    if(Screen_Name){
        model_user.findAll({
            where:{
                Screen_Name: Screen_Name
            }
        }).then(users=>{
            if(users.length==0){
                return res.status(200).send({available: true});
            }else{
                return res.status(200).send({available: false});
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error while checking availability.'));
        });
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Endpoint for email id availability check
 * @param: (Query param)
 *      Email_id
 * @returns: 
 *      Response will look like: {available: true/false}
 */
function checkEmail(req, res){
    //query param
    var Email_id = req.query.Email_id;
    //param check
    if(Email_id){
        model_user.findAll({
            where:{
                Email_id: Email_id
            }
        }).then(users=>{
            if(users.length==0){
                return res.status(200).send({available: true});
            }else{
                return res.status(200).send({available: false});
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error while checking availability.'));
        });
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Endpoint for a user to enter the room. Checks if the user is eligible to enter that room based on his/her current XP
 * @param: (Body Param)
 *      User_id
 *      Room_id
 * @returns: 
 *      whether the request was successful or not
 */
function enterRoom(req, res){
    //body params
    var User_id = req.body.User_id;
    var Room_id = req.body.Room_id;
    //param check
    if(User_id){
        //Check if user is eligible enough to enter the room - minimum xp requirement
        //Thus, first find the room details
        model_room.belongsTo(model_lookup_room, {foreignKey: 'RoomType_id'});
        model_room.findOne({
            where:{
                id: Room_id
            },
            include:[{
                model: model_lookup_room,
                attributes: ['Minimum_XP']
            }]
        }).then(room_found=>{
            if(room_found){
                //while finding the user, where clause should include the min xp requirement
                //Update the user table with given room id
                model_user.update({ Room_id: Room_id },
                {
                    where:{
                        id: User_id,
                        Experience: {
                            $or: {
                                $gt: room_found.Lookup_RoomType.Minimum_XP,
                                $eq: room_found.Lookup_RoomType.Minimum_XP
                            }
                        }
                    }
                }).then(update_result=>{
                    if(update_result[0]){
                        //This means that user entered the room successfully
                        return res.status(200).send(helper.getResponseObject(true, 'User entered the room successfully.'));
                    }else{
                        return res.status(400).send(helper.getResponseObject(false, 'User not found/eligible/updated.'));
                    }
                }).catch(error=>{
                    return res.status(500).send(helper.getResponseObject(false, 'Error entering the room. Code 2.'));
                });
            }else{
                return res.status(400).send(helper.getResponseObject(false, 'Room not found.'));
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error entering the room. Code 1.'));
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters.'));
    }
}

//Making available the endpoints outside the module.
module.exports = {
    signup: signup,
    login: login,
    checkScreenName: checkScreenName,
    checkEmail: checkEmail,
    enterRoom: enterRoom
};