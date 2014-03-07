//var express = require('express');
//var io = require('socket.io');
//var app = express();
//var server = require('http').createServer(handler)
//  , io = io.listen(server);

var fs = require('fs');
//var utils = require('connect').utils;
var serverAddr = "https://192.168.1.142:8080";			// Change this for other deployment

var options = {
  key: fs.readFileSync('chatserver-key.pem'),
  cert: fs.readFileSync('chatserver-cert.pem')
};

var express = require('express')
  , https = require('https')
  , io = require('socket.io')
  , crypto =  require('crypto')
  , app = express()
  , server = https.createServer(options,handler);


var clients = new Array();
var names = new Array();
var count = 0;
var rooms = {};

//app.use(express.session({store: sessionStore, key: sessionId}));

server.listen(8080);
var sio = io.listen(server);

sio.configure('development', function () {
	console.log("configuring the server in dev mode");
  	sio.set('transports', ['websocket']);
  	sio.set('destroy upgrade', false);
// Prevent cross-origin
  	sio.set('origins', serverAddr);
});

sio.configure('production', function(){
	console.log("configuring the server in production mode");
	sio.set('origins', serverAddr);
});

sio.configure(function (){
  sio.set('authorization', function (handshakeData, callback) {
	  //var cookie = utils.parseCookie(handshakeData.headers.cookie);
	  //console.log('Handshake data == ' + cookie);
	  var headers = handshakeData.headers;
	  for(key in headers){
		  console.log('header key  == ' + key + ", value = " + headers[key]);
	  }
      callback(null, true); // error first callback style
  });
});


function handler (req, res) {
	  console.log('inside hanlder==' );
	  fs.readFile(__dirname + '/index.html',
	  function (err, data) {
		if (err) {
		  console.log('error loading index.html' );
		  res.writeHead(500);
		  return res.end('Error loading index.html');
		}
		res.writeHead(200);
		res.end(data);
	  });
}

function getUserIndex(name){
	// Check for duplicate username
	  for(i=0;i<names.length;i++){
		  if(names[i] == name){
			  return i;
		  }
	  }
	  return -1;
}

function ack(){
	  socket.emit('ack');
	  console.log('sending acknowledgment');
}

sio.sockets.on('connection', function (socket) {
  console.log('connection done ==' + socket.handshake.sessionID	);
  //socket.join(socket.handshake.sessionID);
  clients[count] = socket;
  console.log("Active Clients== " + clients.length);

  socket.emit('ready');
  socket.on('set nickname', function (name) {

	// Check for duplicate username
	  if(name == null || getUserIndex(name) > -1){
		  socket.emit('duplicateuser');
		  return;
	  }

      socket.set('nickname', name);
      names[count] = name;
      count++;
      socket.room = name;
      // create a room with the current user name
	  socket.join(name);

      // this emit is for the current socket, since broadcast will not go to this socket
      //socket.emit('activeusers',JSON.stringify(names) );
	  // now broadcast it to all
      sio.sockets.emit('activeusers',JSON.stringify(names) );
  });

	socket.on('msg',function(message,user){
			socket.get('nickname', function (err, name) {
				console.log(name + ' sent the a message to user == ' + user);

			    // broadcast to all, if there is no user selected
			    if(user == null){
				   socket.broadcast.emit('chat',message,name );

			    }else{
					var indx = getUserIndex(user);
					// if the user has not left the session
					if(indx > -1){
						console.log('Adding the socket ' + socket.id  + ' to existing room ' + user);
						// TODO: Fix adding multiple users to the same room.
						socket.join(user);			// join him to the group
					}
					if (sio.sockets.manager.roomClients[socket.id]['/'+user] !== undefined ) {
						console.log('sending message to all in the rooms : ' + user);
						//sio.sockets.in(user).emit("chat", message,name);
						socket.broadcast.to(user).emit("chat", message,name);
					} else {
						socket.emit("update", "Please connect to a room.");
					}
			}
		});

  });
   socket.on('disconnect',function(){
  	      socket.get('nickname', function (err, name) {
  	  	  		console.log(name + ' got disconnected , ' + socket.id);
  				var indx=-1;
  				indx = getUserIndex(name);
  				// remove the user from the array and Client
  				if(indx > -1){
  					clients.splice(indx,1);
  					names.splice(indx,1);
  					count--;
  					var users = sio.sockets.clients(name);
					console.log('removing the socket ' + socket.id  + ' to existing room ' + socket.room);
					for(i=0;i<users.length;i++){
						console.log('socket id = ' + users[i].id + ', name = ' + users[i].name);
					}
  					sio.sockets.emit('removeuser',name);
  				}
  		});

  });

});