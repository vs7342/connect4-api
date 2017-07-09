var Sequelize = require('sequelize');

//Determine the environment
var helper = require('../helper');
var config_file_name = '../configs/' + helper.ENVIRONMENT + '.json';
var mysql_config = require(config_file_name).MySQL;

//Sequelize object which will be used throughout the app
var MySeq = new Sequelize(mysql_config['dbname'], mysql_config['username'], mysql_config['password'], {
    host: mysql_config['host'],
    dialect: 'mysql',
    pool:{
        max: 5,
        min: 0,
        idle: 10000
    }
});

module.exports = MySeq;

