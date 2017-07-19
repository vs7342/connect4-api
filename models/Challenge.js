/**
 * Model for Challenge object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var Challenge = MySeq.define('Challenge', {
    From_User_id: Sequelize.INTEGER,
    To_User_id: Sequelize.INTEGER,
    Created_At: Sequelize.DATE,
    Accepted: Sequelize.BOOLEAN,
    Cancelled: Sequelize.BOOLEAN,
    Expired: Sequelize.BOOLEAN
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = Challenge;

