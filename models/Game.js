/**
 * Model for Game object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var Game = MySeq.define('Game', {
    Is_Finished: Sequelize.BOOLEAN,
    Start_Time: Sequelize.DATE,
    End_Time: Sequelize.DATE,
    Room_id: Sequelize.INTEGER
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = Game;

