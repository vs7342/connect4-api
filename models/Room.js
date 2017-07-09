/**
 * Model for Room object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var Room = MySeq.define('Room', {
    RoomType_id: Sequelize.INTEGER
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = Room;

