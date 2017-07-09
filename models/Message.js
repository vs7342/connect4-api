/**
 * Model for Message object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var Message = MySeq.define('Message', {
    To_id: Sequelize.INTEGER,
    Text: Sequelize.STRING,
    Message_Time: Sequelize.DATE,
    From_User_id: Sequelize.INTEGER,
    MessageType_id: Sequelize.INTEGER
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = Message;

