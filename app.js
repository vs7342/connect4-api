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

//Middleware stuff

//Starting the server on port 80
server.listen(80, function(){
    console.log('API accepting requests on port ' + server.address().port);
});

//Routes
app.get('/test', function(req, res){
    res.status(200).send(helper.getResponseObject(true, "OK"));
});




