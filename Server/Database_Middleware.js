//================= Requirements
var mysql      = require('mysql');
var chalk      = require('chalk');
var ejs        = require('ejs');
var fs         = require('fs');

//mysql agent
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : '<username>',
  password : '<password>',
  database : '<database_name>'
});

//string replace util
String.prototype.format = function () {
  var i = 0, args = arguments;
  return this.replace(/{}/g, function () {
    return typeof args[i] != 'undefined' ? args[i++] : '';
  });
};

//================= Core Functions

function init(callback){
    console.log("init");
    fs.readFile(__dirname + "/config.json" , function (err , data) {
        if (err){

                console.log(err.toString());
                callback(err , null) ;
        }
        else{
            console.log("hello");
            console.log(JSON.parse(data)) ;
            connection = mysql.createConnection(JSON.parse(data).Database);
            callback(null , JSON.parse(data)) ;
        }
    });
}

//database_middleware.connect
var connect = function () {
    init(function(err, data){
        if(err)
            throw error ;
        console.log(chalk.blue("Attempting to connect to the database ..."));
        console.log(data.Database);
        connection.connect();
        console.log(chalk.blue("Connected"));
        });
};

//runs a query on database
var run_query = function(query) {
  connection.query(query , function (error , results , fields) {
    if(error) throw error ;
    else{
      console.log("query is done!");
      return results;
    }
  })
};

//set the given confirmation code for the given username
function set_confirm_code(data , callback){
    console.log(chalk.yellow("DB_Middleware:set-confirm-code >>> ") + chalk.white("update confirm code" ));
    query = "CALL set_confirm_code('"   +
            data.confirmation_code+ "','" +
            data.username  +"');" ;

    console.log(chalk.yellow("DB_Middleware:set-confirm-code >>> ") + chalk.blue("query: \n"+ query ));
    connection.query(query , function (error , result) {
        if(error)
            callback(error.toString() , null) ;
        else
            callback(null , result);
    });

}

//fetch the confirmation code of a given username
function fetch_confirm_code(userdata , callback){
    console.log(chalk.yellow("DB_Middleware:fetch-confirm-code >>> ") + chalk.white("fetching confirm code..." ));
    query = "SELECT confirm_code FROM user WHERE username='"+userdata.username+"'" ;

    console.log(chalk.yellow("DB_Middleware:register-user >>> ") + chalk.blue("query: \n" + query ));
    connection.query(query , function(error , result){
        if(error)
            callback(error.toString() , null);
        else
        {
            console.log(chalk.yellow("DB_Middleware:register-user >>> ") + chalk.blue("fetched code " + JSON.stringify(result[0] )));
            callback(null , result[0]) ;
        }
    });

}

//set confirm code status
function set_confirm_code_status(userdata , status , callback){
    console.log(chalk.yellow("DB_Middleware:fetch-confirm-code >>> ") + chalk.white("updating confirm code status" ));

    query = "CALL set_confirm_code_status ('"+userdata.username + "'," +status+ ");" ;

    connection.query(query , function (error , result) {
        if(error)
            callback(error.toString());
        else
            callback(null , result);
    }) ;
}

//register a user with given user data
function register_user(userdata , callback){
    console.log(chalk.yellow("DB_Middleware:register-user >>> ") + chalk.white("register user to database" ));

    var query2 ="CALL register_user('" +
        userdata["username"] + "','"+
        userdata["email"]+"','" +
        userdata["first_name"] + "','" +
        userdata["last_name"]+"','"+
        userdata["password"]+"');";

    connection.query(query2 , function(error , info){
            if(error)
                callback(error , null);
            else
                callback(null , "ok");
    });
    console.log(chalk.green("$$$--USER ADD---$$$ \n" )+ query2);

}

//fetch user data
function fetch_user_prime_data(userdata , callback) {
    console.log(chalk.yellow("DB_Middleware:fetch-user-prime-data >>> ") + chalk.white("fetch user primary info" ));

    //forge a proper query
    var query=  "SELECT username , first_name , last_name , email " +
                "FROM user " +
                "WHERE username= '" +userdata["username"]+ "';";

    console.log(chalk.yellow("DB_Middleware:fetch-user-prime-data >>> ") + chalk.blue("forged query : " + query ));

    connection.query(query , function (errors , results , fields) {
        if(errors)
            callback(errors , null);    //if there was an internal error of Mariadb throw it
        else if(!results)
            callback(new Error("NOT FOUND") , null);    //if there is no result
        else{
            //else if everything is all right send back the results
            console.log(chalk.yellow("DB_Middleware:fetch-user-prime-data >>> ") + chalk.blue("fetched info \n "+JSON.stringify(results[0])));
            callback(null , results[0]);
        }
    });
}

//checks the user password provided its entry passwor
function check_user_password(userdata , callback){
    console.log(chalk.yellow("DB_Middleware:check-user-password >>> ") + chalk.white("checking password" ));

    console.log("1- =>" + JSON.stringify(userdata));
    //forge a proper query
    var query= "SELECT password , is_confirmed FROM user WHERE username= '"+userdata["username"]+"'" ;

    //run the query
    connection.query(query , function(error , results , fields){
        if(error)
            callback(error , null) ;
        else if(!results[0])
            callback(new Error("NOT FOUND") , null);
        else {

            console.log("2- =>" + JSON.stringify(results[0]));
            fetched_info = results[0];
            fetched_pass = JSON.stringify(fetched_info.password);
            console.log("fetched-pass"  + fetched_pass + "\ngiven pass" + userdata.password);
            if(fetched_info["is_confirmed"] == 0)
                callback(new Error("Not Confirmed") , null);
            else
                callback(null , JSON.stringify(fetched_info.password) == JSON.stringify(userdata.password));
        }
    });
}

//sends a message
function send_message(data , callback){
    console.log(chalk.yellow("DB_Middleware:send-message >>> ") + chalk.white("sending message" ));

    //forge query
    var query = "CALL send_message(" +  JSON.stringify(data.sender) + " , " +
                                        JSON.stringify(data.receiver) + " , " +
                                        JSON.stringify(data.subject) +" , " +
                                        JSON.stringify(data.content) + "); " ;
    //run the query
    connection.query(query , function (error , info) {
        if(error)
            callback(error , null) ;
        else
            callback(null  , info) ;

    })

}

//fetch inbox
function fetch_user_inbox_subjects(userdata , callback){
     console.log(chalk.yellow("DB_Middleware:fetch-user-inbox-subject >>> ") + chalk.white("fetch inbox subjects" ));

    //forge a proper query
    var query = "SELECT subject , is_checked FROM message , send_message WHERE receiver_username = "+JSON.stringify(userdata.username)  +" AND id = message_id ";

    //run the query
    connection.query(query , function(errors , results , fields){
        if(errors)
            callback(error , null );
        else if(!results)
            callback(new Error("NOT FOUND") , null) ;
        else {
            callback(null , results);
        }
    });
}

//fetch sent mails
function fetch_user_sent_subjects(userdata , callback){
     console.log(chalk.yellow("DB_Middleware:fetch-user-sent-subjects >>> ") + chalk.white("fetch sent subjects"));

     //forge a proper query
    var query = "SELECT subject FROM message , send_message WHERE sender_username = "+JSON.stringify(userdata.username) +" AND id = message_id ";

    //run the query
    connection.query(query , function(error , result , fields){
        if(error)
            callback(error , null );
        else if(!result)
            callback(new Error("NOT FOUND") , null) ;
        else {
            callback(null , result);
        }
    });
}

//fetch a specific message provided its subject from inbox
function fetch_inbox_message_content(data , callback){
    console.log(chalk.yellow("DB_Middleware:fetch_inbox_message_content >>> ") + chalk.white("fetch sent subjects"));

    //forge a proper query
    var query = "SELECT * FROM message , send_message WHERE message_id = id AND subject=" + JSON.stringify(data.subject) +
        "AND receiver_username = " +JSON.stringify(data.username);

    //run the query
    connection.query(query , function(error , result , fields){
        if(error)
            callback(error , null);
        else if(!result[0])
            callback(new Error("NOT FOUND") , null) ;
        else
            callback(null , result[0]);
    });
}

//fetch a specific message provided its subject from outbox
function fetch_outbox_message_content(data , callback){
    console.log(chalk.yellow("DB_Middleware:fetch_inbox_message_content >>> ") + chalk.white("fetch sent subjects"));

    //forge a proper query
    var query = "SELECT * FROM message , send_message WHERE message_id = id AND subject=" + JSON.stringify(data.subject) +
        "AND sender_username = " +JSON.stringify(data.username);

    //run the query
    connection.query(query , function(error , result , fields){
        if(error)
            callback(error , null);
        else if(!result[0])
            callback(new Error("NOT FOUND") , null) ;
        else
            callback(null , result[0]);
    });
}

function check_message(message_id , callback){
    console.log(chalk.yellow("DB_Middleware:check_message >>> ") + chalk.white("fetch sent subjects"));

    var query = "UPDATE message SET is_checked = 1 WHERE id = " + message_id ;

    connection.query(query , function (err , result ) {
        if (err)
            callback(err , null);
        else
            callback(null , result);

    })
}

//prime operations
exports.connect = connect;
exports.run_query = run_query;

//user related
exports.register_user = register_user;
exports.fetch_user_prime_data = fetch_user_prime_data;
exports.check_user_password = check_user_password;

//confirmation related
exports.set_confirm_code = set_confirm_code ;
exports.fetch_confirm_code = fetch_confirm_code ;
exports.set_confirm_code_status  = set_confirm_code_status;

//messaging related
exports.send_message = send_message;
exports.fetch_user_inbox_subjects = fetch_user_inbox_subjects;
exports.fetch_user_sent_subjects = fetch_user_sent_subjects ;
exports.fetch_inbox_message_content = fetch_inbox_message_content ;
exports.fetch_outbox_message_content= fetch_outbox_message_content ;
exports.check_message = check_message;

//TEST --
function test(){
    console.log("testing ejs");
    var options = {"confirmation_code" : "Gilbert"};

   var template = ejs.renderFile(__dirname+"/views/confirm_mail.ejs" , options   , function ( err , html){
        console.log("asdfasdf");
        if(err)
            console.log(err.toString());
        else {
            console.log("shit");
             console.log(html)  ;
            }
            console.log("asdfasdf2");
    });
   console.log(__dirname)  ;
}

//END TEST

/**
 * Created by navid on 3/2/17.
 */
