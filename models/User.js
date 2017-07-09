/**
 * Model for User object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var User = MySeq.define('User', {
    Email_id: Sequelize.STRING,
    First_Name: Sequelize.STRING,
    Last_Name: Sequelize.STRING,
    Screen_Name: Sequelize.STRING,
    Password: Sequelize.STRING,
    Win_Count: Sequelize.INTEGER,
    Games_Played: Sequelize.INTEGER,
    User_Since: Sequelize.DATE,
    Experience: Sequelize.INTEGER,
    Room_id: Sequelize.INTEGER
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = User;

