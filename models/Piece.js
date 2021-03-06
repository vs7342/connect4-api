/**
 * Model for Piece object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var Piece = MySeq.define('Piece', {
    Position_X: {type: Sequelize.INTEGER, validate:{min: 0, max: 6}},
    Position_Y: {type: Sequelize.INTEGER, validate:{min: 0, max: 5}},
    Player_id: Sequelize.INTEGER,
    Game_id: Sequelize.INTEGER,
    Room_id: Sequelize.INTEGER,
    User_id: Sequelize.INTEGER
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = Piece;

