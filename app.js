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

//Initializing the express app
var app = express();
var server = http.createServer(app);

//Middleware stuff - So that we can use the request.body in endpoints - Will accept both JSON or urlencoded at a time.
app.use(body_parser.json());
app.use(body_parser.urlencoded());

//Middleware stuff - CORS and API Key header
app.use(function(req, res, next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, api-key');
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




