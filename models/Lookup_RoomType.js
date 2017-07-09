/**
 * Model for Lookup_RoomType object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var Lookup_RoomType = MySeq.define('Lookup_RoomType', {
    Name: Sequelize.STRING,
    Level: Sequelize.INTEGER,
    Minimum_XP: Sequelize.INTEGER
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = Lookup_RoomType;

