/**
 * This is the main entry point for the Node/Express app.
 */

//Node JS Modules
var express = require('express');
var http = require('http');
var body_parser = require('body-parser');
var socket_io = require('socket.io');
var jwt = require('jsonwebtoken');

//Helper functions
var helper = require('./helper');

//Fetching secret for jwt
var config_file_name = './configs/' + helper.ENVIRONMENT + '.json';
const jwt_secret = require(config_file_name).JwtSecret;

//Services
var service_user = require('./services/UserService');
var service_message = require('./services/MessageService');
var service_game = require('./services/GameService');

//Initializing the express app
var app = express();
var server = http.createServer(app);
var io = socket_io(server);

//Middleware stuff - So that we can use the request.body in endpoints - Will accept both JSON or urlencoded at a time.
app.use(body_parser.json());
app.use(body_parser.urlencoded({extended: true}));

//Specifically for browser since it sends pre-flight requests
app.use(function(req, res, next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, api-key, access-token');
    res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');

    if(req.method === 'OPTIONS'){
        res.status(204).send();
    }else{
        next();
    }
})

// Moving these endpoints up since these don't require api-key header
app.post('/signup', service_user.signup);
app.post('/login', service_user.login);

//Middleware stuff - CORS and API Key header
app.use(function(req, res, next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, api-key');
    res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');

    if(req.headers['api-key']){
        //Grab the token from the header
        var token = req.headers['api-key'];

        //Verify the signature/token
        jwt.verify(token, jwt_secret, function(err, decoded){
            if(err){
                return res.status(403).send({
                    message: "Invalid token"
                })
            }else{
                console.log(decoded);
                req.decoded = decoded;
                next();
            }
        });

    }else{
        res.status(403).send(helper.getResponseObject(false, 'Please provide a token.'));
    }
})

//Starting the server on port 80
server.listen(80, function(){
    console.log('API accepting requests on port ' + server.address().port);
});

//Test Route - GET
app.get('/test', function(req, res){
    res.status(200).send(helper.getResponseObject(true, "OK"));
});

//Test Route - To test request bodies
app.post('/test', function(req, res){
    var test_param = req.body.test_param;
    res.status(200).send({'test_param': test_param});
})

/* Socket IO */

//CORS
io.origins("*:*");

// //Middleware to check request headers
// io.use(function(socket, next){
//     var req_api_key = socket.request.headers['api-key'];
//     if(req_api_key == 'E4B7BFA0C93EEDA1AB0928404FF5CFAEDB46847D31B475EFE5F69D8C3E46D074'){
//         next();
//     }else{
//         socket.disconnect(true);
//     }
// });

//Socket routes
var message_io = io.of('/messages');

message_io.on('connection', function messageChat(socket){
    //Connection Handler
    console.log("User connected to individualMessageChat.");
    var socket_data = socket.request;

    //Individual Message handler
    socket.on('send-ind-message', function(data){
        message_io.emit('client-rcv-ind-msg', data);
    });

    //Room Message handlers

        //1. Joining a room
        socket.on('join-room', function(data){
            //Leave all the rooms first since a user can only be inside one room
            for(var room in socket.rooms){
                socket.leave(room);
                //Notify the client connected in that room that this client has left
                message_io.to(room).emit('client-left-room', {
                    user_id: socket.user_id,
                    user_screen_name: socket.user_screen_name
                });
                console.log(socket.user_id + ' left ' + room);
            }

            //Get the room id from the data
            var room_id = data.room_id;
            
            //Add data to socket
            socket.user_id = data.user_id;
            socket.user_screen_name = data.user_screen_name;
            
            //join the room
            socket.join('room_' + room_id);

            //Let the clients connected to the room know that there is another client who joined
            message_io.to('room_' + room_id).emit('client-join-room', {
                user_id: socket.user_id,
                user_screen_name: socket.user_screen_name
            })
        })

        //2. Send Message in room
        socket.on('send-room-message', function(data){
            //Get the data from sender
            var room_id = data.room_id;
            //Emit to connected recievers
            socket.broadcast.to('room_' + room_id).emit('client-rcv-room-msg', data);
        })

    //Disconnecting handler
    socket.on('disconnecting', function(){
        //Get all rooms the client was in..
        var all_rooms_of_user = socket.rooms;
        //Check since there might not be any rooms for a client
        if(all_rooms_of_user){
            for(var single_room in all_rooms_of_user){
                //Let all rooms know that the user has left..
                message_io.to(single_room).emit('client-left-room', {
                    user_id: socket.user_id,
                    user_screen_name: socket.user_screen_name
                });
                console.log(socket.user_id + ' left ' + single_room);
            }
        }
    });

    //Disconnect handler
    socket.on('disconnect', function(){
        console.log("User disconnected from individualMessageChat.");
        console.log(socket.rooms);
    });
});

/* Application Routes */

//User Service
app.get('/screen/available', service_user.checkScreenName);
app.get('/email/available', service_user.checkEmail);
app.put('/enter/room', service_user.enterRoom);

//Message Service
app.post('/message/individual', service_message.sendIndividualMessage);
app.get('/message/individual/from/all', service_message.getAllIndividualMessages);
app.get('/message/individual/from/single', service_message.getIndividualMessagesFromSingleUser)
app.get('/message/individual/conversation', service_message.getIndividualMessageConversation);
app.post('/message/room', service_message.sendGroupMessage);
app.get('/message/room', service_message.getGroupMessages);

//Game Service
app.get('/room/details', service_game.getRoomDetails);
app.post('/challenge', service_game.challengePlayer);
app.put('/challenge/accept', service_game.acceptChallenge);
app.put('/challenge/cancel', service_game.cancelChallenge);
app.put('/challenge/decline', service_game.declineChallenge);
app.get('/challenge/incoming', service_game.incomingChallengesHB);
app.get('/challenge/ongoing', service_game.ongoingChallengeHB);
app.post('/game', service_game.initGame);
app.post('/piece', service_game.postPiece);

//Misc
app.get('/lookup/room', service_game.getRoomTypes);
app.get('/rooms', service_game.getRooms);

//Socket endpoints
app.get('/socket/clients', function(req, res){
    //Get room id
    var room_id = req.query.room_id;
    
    //Check if the room exists
    if(!message_io.adapter.rooms['room_' + room_id]){
        //room does not exists
        //return an empty array
        return res.status(200).send({
            success: true,
            users: []
        });
    }

    //Fetch clients connected to socket
    try{
        var online_users_in_room = [];
        var clients = message_io.adapter.rooms['room_' + room_id].sockets;
        for (var clientId in clients) {
            var client_socket = message_io.sockets[clientId];
            online_users_in_room.push({
                id: client_socket.user_id,
                Screen_Name: client_socket.user_screen_name
            });
        }
        return res.status(200).send({
            success: true,
            users: online_users_in_room
        });
    } catch(e){
        console.log(e);
        return res.status(200).send(helper.getResponseObject(false, 'Error retrieving connected clients.'));
    }
});
