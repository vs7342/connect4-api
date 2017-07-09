/**
 * Model for Lookup_MessageType object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var Lookup_MessageType = MySeq.define('Lookup_MessageType', {
    Type: Sequelize.STRING,
    Code: Sequelize.CHAR(3)
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = Lookup_MessageType;

