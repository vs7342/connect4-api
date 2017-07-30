/**
 * Model for Challenge object
 */

var Sequelize = require('sequelize');
var MySeq = require('../models/MySeq');

var Challenge = MySeq.define('Challenge', {
    From_User_id: Sequelize.INTEGER,
    To_User_id: Sequelize.INTEGER,
    Created_At: Sequelize.DATE,
    Accepted: {
        type: Sequelize.BOOLEAN, 
        allowNull: true,
        get(){
            //Had to add this check since a null value was being returned as a weird buffer array
            if(this.getDataValue('Accepted') && this.getDataValue('Accepted').length==0)
                return null;
            else
                return this.getDataValue('Accepted');
        }
    },
    Cancelled: Sequelize.BOOLEAN,
    Expired: Sequelize.BOOLEAN
}, {
    freezeTableName: true,
    logging: false,
    timestamps: false
});

module.exports = Challenge;

