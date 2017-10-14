/**
 * Endpoints/Services related to Message and related objects
 */

//Node modules
var validator = require('validator');
var moment = require('moment');

//Custom modules
var model_message = require('../models/Message');
var model_lookup_message_type = require('../models/Lookup_MessageType');
var model_room = require('../models/Room');
var model_user = require('../models/User');
var helper = require('../helper');

/**
 * @author: Vidit Singhal
 * @description: Endpoint for sending individual message
 * @param: (Body params)
 *      Text
 *      From_User_id
 *      To_id - This should be User ID
 */
function sendIndividualMessage(req, res){
    //body params
    var Text = req.body.Text;
    var From_User_id = req.body.From_User_id;
    var To_id = req.body.To_id;
    //param check
    if(Text && From_User_id && To_id){
        //Check for self messaging
        if(From_User_id == To_id){
            return res.status(400).send(helper.getResponseObject(false, 'From ID and To ID should be different.'));
        }

        //Text length check
        if(Text.length <= 250){
            //Need to check if To_id is actually a user.. since To_id is not a foreign key to any table..Thus won't throw any error
            model_user.findAll({
                where:{
                    id: To_id
                }
            }).then(legit_user=>{
                if(legit_user.length==1){
                    //We can go ahead and create a message
                    //Fetch the lookup message type id for 'IND' messages
                    model_lookup_message_type.findOne({
                        where:{
                            Code: 'IND'
                        }
                    }).then(msg_type=>{
                        //Insert the message
                        model_message.create({
                            To_id: To_id,
                            Text: Text,
                            Message_Time: moment().format(),
                            From_User_id: From_User_id,
                            MessageType_id: msg_type.id
                        }).then(msg_created=>{
                            return res.status(200).send({
                                success: true,
                                message: msg_created
                            });
                        }).catch(error=>{
                            return res.status(500).send(helper.getResponseObject(false, 'Error sending message. Code 2.'));
                        });
                    })
                }else{
                    //Something is fishy.. since a user must have been found.. abort
                    return res.status(400).send(helper.getResponseObject(false, 'Invalid To_id - User not found.'));
                }
            }).catch(error=>{
                return res.status(500).send(helper.getResponseObject(false, 'Error sending message. Code 1.'));
            });
        }else{
            return res.status(400).send(helper.getResponseObject(false, 'Text Message cannot be more than 250 characters'));
        }
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Endpoint to fetch individual messages recieved from all users
 * @param: (Query params)
 *      User_id
 */
function getAllIndividualMessages(req, res){
    //param
    var User_id = req.query.User_id;
    //param check
    if(User_id){
        //Fetch the lookup message type id for 'IND' messages
        model_lookup_message_type.findOne({
            where:{
                Code: 'IND'
            }
        }).then(msg_type=>{
            //Fetch messages
            model_message.findAll({
                attributes:['Text', 'Message_Time', 'From_User_id'],
                where:{
                    To_id: User_id,
                    MessageType_id: msg_type.id
                }
            }).then(messages=>{
                return res.status(200).send(messages);
            }).catch(error=>{
                return res.status(500).send(helper.getResponseObject(false, 'Error fetching messages.'));
            });
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Endpoint to fetch individual messages recieved from a single user
 * @param: (Query params)
 *      User_id
 *      From_User_id
 */
function getIndividualMessagesFromSingleUser(req, res){
    //params
    var User_id = req.query.User_id;
    var From_User_id = req.query.From_User_id;
    //params check
    if(User_id && From_User_id){
        //Fetch the lookup message type id for 'IND' messages
        model_lookup_message_type.findOne({
            where:{
                Code: 'IND'
            }
        }).then(msg_type=>{
            //Fetch messages
            model_message.findAll({
                attributes:['Text', 'Message_Time'],
                where:{
                    From_User_id: From_User_id,
                    To_id: User_id,
                    MessageType_id: msg_type.id
                }
            }).then(messages=>{
                return res.status(200).send(messages);
            }).catch(error=>{
                return res.status(500).send(helper.getResponseObject(false, 'Error fetching messages.'));
            });
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Endpoint to fetch a set of messages exchanged between 2 users (Individual message conversation)
 * @param: (Query params)
 *      user_id_1
 *      user_id_2
 */
function getIndividualMessageConversation(req, res){
    //body params
    var user_id_1 = req.query.user_id_1;
    var user_id_2 = req.query.user_id_2;
    //param check
    if(user_id_1 && user_id_2){
        //Fetch the lookup message type id for 'IND' messages
        model_lookup_message_type.findOne({
            where:{
                Code: 'IND'
            }
        }).then(msg_type=>{
            //Fetch messages
            model_message.belongsTo(model_user, {foreignKey: 'From_User_id'})
            model_message.findAll({
                attributes:['id', 'From_User_id', 'Text', 'Message_Time'],
                include:[{
                    model: model_user,
                    attributes: ['Screen_Name']
                }],
                where:{
                    $or:[{
                            $and:{
                                From_User_id: user_id_1,
                                To_id: user_id_2
                            }
                        },{
                            $and:{
                                From_User_id: user_id_2,
                                To_id: user_id_1,
                            }
                    }],
                    MessageType_id: msg_type.id
                }
            }).then(messages=>{
                return res.status(200).send({success: true, messages:messages});
            }).catch(error=>{
                return res.status(500).send(helper.getResponseObject(false, 'Error fetching messages.'));
            });
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Endpoint for sending Group/Room message
 * @param: (Body params)
 *      Text
 *      From_User_id
 *      Room_id - This should be Room ID
 */
function sendGroupMessage(req, res){
    //body params
    var Text = req.body.Text;
    var From_User_id = req.body.From_User_id;
    var To_id = req.body.Room_id;
    //param check
    if(Text && From_User_id && To_id){
        //Text length check
        if(Text.length <= 250){
            //Check in 'Room' table whether the given To_id is a Room id
            model_room.findAll({
                where:{
                    id: To_id
                }
            }).then(rooms=>{
                if(rooms.length==1){
                    //Now check if the user is present in that room since a person can be assigned to a single room only.
                    model_user.findAll({
                        where:{
                            id: From_User_id,
                            Room_id: To_id
                        }
                    }).then(legit_user=>{
                        if(legit_user.length==1){
                            //We can now proceed with creation of message
                            //Fetch the lookup message type id for 'GRP' messages
                            model_lookup_message_type.findOne({
                                where:{
                                    Code: 'GRP'
                                }
                            }).then(msg_type=>{
                                //Insert the message
                                model_message.create({
                                    To_id: To_id,
                                    Text: Text,
                                    Message_Time: moment().format(),
                                    From_User_id: From_User_id,
                                    MessageType_id: msg_type.id
                                }).then(msg_created=>{
                                    return res.status(200).send({
                                        success: true,
                                        message: msg_created
                                    });
                                }).catch(error=>{
                                    return res.status(500).send(helper.getResponseObject(false, 'Error sending message. Code 3.'));
                                });
                            });
                        }else{
                            //Something fishy..abort..person is not inside the room..how can the user send the message then??!
                            return res.status(400).send(helper.getResponseObject(false, 'Possible issues - User not in room / Invalid user id.'));
                        }
                    }).catch(error=>{
                        return res.status(500).send(helper.getResponseObject(false, 'Error sending message. Code 2.'));
                    });
                }else{
                    //Something fishy..abort..since only 1 room id should have been present
                    return res.status(400).send(helper.getResponseObject(false, 'Room not found. Invalid To_id.'));
                }
            }).catch(error=>{
                return res.status(500).send(helper.getResponseObject(false, 'Error sending message. Code 1.'));
            });
        }else{
            return res.status(400).send(helper.getResponseObject(false, 'Text Message cannot be more than 250 characters'));
        }
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

/**
 * @author: Vidit Singhal
 * @description: Endpoint to fetch messages in a single room
 * @param: (Query params)
 *      Room_id
 *      User_id (Tecnhically not needed.. Just need it for checking whether that user is in the given room)
 */
function getGroupMessages(req, res){
    //params
    var Room_id = req.query.Room_id;
    var User_id = req.query.User_id;
    //params check
    if(Room_id && User_id){
        //Check if the requesting user is currently in that room
        model_user.findAll({
            where:{
                id: User_id,
                Room_id: Room_id
            }
        }).then(legit_user=>{
            if(legit_user.length==1){
                //User is inside the room..he can be given access to messages
                //Fetch the lookup message type id for 'GRP' messages
                model_lookup_message_type.findOne({
                    where:{
                        Code: 'GRP'
                    }
                }).then(msg_type=>{
                    //Fetch messages
                    model_message.belongsTo(model_user, {foreignKey: 'From_User_id'});
                    model_message.findAll({
                        attributes:['id', 'From_User_id', 'Text', 'Message_Time'],
                        where:{
                            To_id: Room_id,
                            MessageType_id: msg_type.id
                        },
                        include: [{
                            model: model_user,
                            attributes: ['Screen_Name']
                        }]
                    }).then(messages=>{
                        return res.status(200).send({
                            success: true,
                            messages: messages
                        });
                    }).catch(error=>{
                        return res.status(500).send(helper.getResponseObject(false, 'Error fetching messages. Code 2.'));
                    });
                })
            }else{
                //User not in room..No messages should be returned
                return res.status(400).send(helper.getResponseObject(false, 'Possible issues - User not in room / Invalid room id / Invalid user id.'));
            }
        }).catch(error=>{
            return res.status(500).send(helper.getResponseObject(false, 'Error fetching messages. Code 1.'));
        })
    }else{
        return res.status(400).send(helper.getResponseObject(false, 'Insufficient request parameters'));
    }
}

//Making available services outside the module
module.exports = {
    sendIndividualMessage : sendIndividualMessage,
    getAllIndividualMessages : getAllIndividualMessages,
    getIndividualMessagesFromSingleUser: getIndividualMessagesFromSingleUser,
    getIndividualMessageConversation: getIndividualMessageConversation,
    sendGroupMessage : sendGroupMessage,
    getGroupMessages : getGroupMessages
}