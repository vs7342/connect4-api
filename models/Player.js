/**
 * Model for Player object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var Player = MySeq.define('Player', {
    Has_Turn: Sequelize.BOOLEAN,
    Is_Challenger: Sequelize.BOOLEAN,
    Is_Winner: Sequelize.BOOLEAN,
    Color: Sequelize.STRING,
    Last_Played: Sequelize.DATE,
    Game_id: Sequelize.INTEGER,
    Room_id: Sequelize.INTEGER,
    User_id: Sequelize.INTEGER
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = Player;

