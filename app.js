/**
 * This is the main entry point for the Node/Express app.
 */

//Node JS Modules
var express = require('express');
var http = require('http');
var body_parser = require('body-parser');

//Helper functions
var helper = require('./helper');

//Services
var service_user = require('./services/UserService');
var service_message = require('./services/MessageService');
var service_game = require('./services/GameService');

//Initializing the express app
var app = express();
var server = http.createServer(app);

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

//Middleware stuff - CORS and API Key header
app.use(function(req, res, next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, api-key, access-token');
    res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');

    if(req.headers['api-key'] == 'E4B7BFA0C93EEDA1AB0928404FF5CFAEDB46847D31B475EFE5F69D8C3E46D074'){
        next();
    }else{
        res.status(403).send(helper.getResponseObject(false, 'Invalid API Key.'));
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

/* Application Routes */

//User Service
app.post('/signup', service_user.signup);
app.post('/login', service_user.login);
app.get('/screen/available', service_user.checkScreenName);
app.get('/email/available', service_user.checkEmail);
app.put('/enter/room', service_user.enterRoom);

//Message Service
app.post('/message/individual', service_message.sendIndividualMessage);
app.get('/message/individual/from/all', service_message.getAllIndividualMessages);
app.get('/message/individual/from/single', service_message.getIndividualMessagesFromSingleUser)
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

