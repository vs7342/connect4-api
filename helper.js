/**
 * This file will consist of utility methods/variables used by the app
 */

//Mainly used for configs
module.exports.ENVIRONMENT = 'dev';
//module.exports.ENVIRONMENT = 'qa';
//module.exports.ENVIRONMENT = 'prod';

/**
 * Returns a JSON object with success and message as keys and corresponding parameters as values
 * This will be used to construct a basic response body
 */
module.exports.getResponseObject = function(isSuccessful, message){
    return {
        "success": isSuccessful,
        "message": message
    };
};