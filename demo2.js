/*
   __       _    _                _ _  ___     _      
  / _| __ _| | _| |__  _ __ _   _| | |/ / |__ (_)_ __ 
 | |_ / _` | |/ / '_ \| '__| | | | | ' /| '_ \| | '__|
 |  _| (_| |   <| | | | |  | |_| | | . \| | | | | |   
 |_|  \__,_|_|\_\_| |_|_|   \__,_|_|_|\_\_| |_|_|_|   

*/

var express = require('express');
var bodyParser = require('body-parser');
var mongo = require('mongojs');
var db = mongo('localhost:27017/olio-rena',['messages','reply_messages']);
var path    = require("path");
var request = require('request');
var xml = require('xml');
var async = require('async')

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var fs = require('fs');
var speech = require('@google-cloud/speech')({
  projectId: 'lateral-rider-156708',
  keyFilename: 'api-cloud-speech.json'
});

var restcomm_key = "xxxxx",
    restcomm_token = "xxxxx",
    from = "xxxxx"

app.use(bodyParser.urlencoded({
  extended: true,
  limit: '50mb'
}));
app.use(function(req, res, next) {
    var contentType = req.headers['content-type'] || ''
      , mime = contentType.split(';')[0];

    console.log('mime: '+mime)
    if (mime == 'application/json' || mime == 'application/x-www-form-urlencoded') {
      
      return next();
    }

    req.rawBody = '';
    // req.setEncoding('base64');
    req.setEncoding(null);
    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });
    req.on('end', function() {
        next();
    });
});
app.engine('.html', require('ejs').__express);
app.set('view engine', 'html');
app.use(bodyParser.json());
//app.use(bodyParser.raw());

app.use('/views', express.static(__dirname + '/views'));
app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));
app.use('/images', express.static(__dirname + '/images'));
app.use('/resources', express.static(__dirname + '/resources'));

app.use(function(req, res, next){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers','X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);

  next();
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var port = process.env.PORT || 6546;

var router  = express.Router();
var router2 = express.Router();
// Authentication module.
var auth = require('http-auth');
var basic = auth.basic({
        realm: "Authentication Area"
    }, function (username, password, callback) {
        // Custom authentication
        // Use callback(error) if you want to throw async error.
        callback(username === "xxxxx" && password === "xxxxx");
    }
);

router.route('/:channel/record')
  .get(function(req, res){
    console.log('file: '+req.query.file);
    //res.send('aha: '+req.body.haha);

    var split = req.query.file.split("/");
    var filename = split[split.length-1];
    console.log('filename: '+filename);
    /*var file = fs.createWriteStream("./resources/"+filename);
    request({url:req.query.file}, function (error, response, body) {
      response.pipe(file);
    });*/

    var file = request
      ({url: req.query.file, rejectUnhauthorized : false})
      .on('error', function(err) {
        console.log(err);
      })
      .on('response', function(response) {
        var st = response.pipe(fs.createWriteStream("./resources/"+filename));
        st.on('finish', function() {

          speech.recognize('./resources/'+filename, {
            encoding: 'LINEAR16',
            sampleRate: 8000,
            languageCode: 'ms-MY'
          }, function(err, transcript) {
            // transcript = 'how old is the Brooklyn Bridge' 
            if(transcript){
              console.log('transcript: '+transcript)
              var img = "/images/olio-logo.jpg"
                if(req.query.caller_id == "+601344288xx") {
                  img = "/images/sam.jpg"
                }
                if(req.query.caller_id == "+6011406875xx") {
                  img = "/images/amir.jpg"
                }
                if(req.query.caller_id == "+601756722xx") {
                  img = "/images/cong.jpg"
                }
                if(req.query.caller_id == "+601823884xx") {

                }

                var di = db.messages.insert({
                  caller: req.query.caller_id,
                  callSid: req.query.sid,
                  //transcript1: place,
                  image: img,
                  message: transcript,
                  recording_url: req.query.file,
                  audio: './resources/'+filename,
                  channel: req.params.channel,
                  created_at: new Date(),
                  updated_at: new Date()
                }, function(err, items){
                      if(err)
                        res.send(err);

                    //items.forEach(function(i,v){
                      var date = new Date();

                      new_date = ('0'+date.getDate()).slice(-2)+"/"+('0'+(date.getMonth()+1)).slice(-2)+"/"+date.getFullYear()+" "+('0'+date.getHours()).slice(-2)+":"+('0'+date.getMinutes()).slice(-2)+":"+('0'+date.getSeconds()).slice(-2);

                      var msgs = {
                        id: mongo.ObjectId(items._id),
                        //step: 1,
                        message: transcript,
                        image: img,
                        //transcript2: trans,
                        caller: req.query.caller_id,
                        callSid: req.query.sid,
                        recording_url: req.query.file,
                        //place_coord: place_coord,
                        created_at: new_date,
                        updated_at: new Date()

                      };
                      io.of('/'+req.params.channel).emit('message', msgs);
                    //});
                    


                });
                fs.createReadStream('./resources/'+filename).pipe(fs.createWriteStream('./resources/last.wav'));
                res.json(transcript);
            }
          });
        })
      })

    /*
    var file = request
      ({url: req.query.file, rejectUnhauthorized : false})
      .on('error', function(err) {
        console.log(err);
      })
      .on('response', function(response) {
        var st = response.pipe(fs.createWriteStream("./resources/"+filename));
        st.on('finish', function() {
          var params = {
            // From file
            audio: fs.createReadStream("./resources/"+filename),
            content_type: 'audio/wav',
            model: 'en-US_NarrowbandModel',
            timestamps: true,
            word_alternatives_threshold: 0.9,
            continuous: true
          };
          
          speech_to_text.recognize(params, function(err2, res2) {
            if (err2)
              console.log(err2);
            else {
              var obj = JSON.stringify(res2, null, 2);
              console.log(obj);
              
              var trans = "";
              if(res2.results.length>0){

                trans = res2.results[0].alternatives[0].transcript;

                var img = "/images/dev_con_logo.jpg"
                if(req.query.caller_id == "+60175848137") {
                  img = "/images/joe.jpg"
                }
                if(req.query.caller_id == "+60122973281") {
                  img = "/images/saifi.jpg"
                }
                if(req.query.caller_id == "+60192094953") {
                  img = "/images/iqbal.jpg"
                }
                if(req.query.caller_id == "+60182388407") {

                }

                var di = db.messages.insert({
                  caller: req.query.caller_id,
                  callSid: req.query.sid,
                  //transcript1: place,
                  image: img,
                  message: trans,
                  recording_url: req.query.file,
                  audio: './resources/'+filename,
                  channel: req.params.channel,
                  created_at: new Date(),
                  updated_at: new Date()
                }, function(err, items){
                      if(err)
                        res.send(err);

                    //items.forEach(function(i,v){
                      var date = new Date();

                      new_date = ('0'+date.getDate()).slice(-2)+"/"+('0'+(date.getMonth()+1)).slice(-2)+"/"+date.getFullYear()+" "+('0'+date.getHours()).slice(-2)+":"+('0'+date.getMinutes()).slice(-2)+":"+('0'+date.getSeconds()).slice(-2);

                      var msgs = {
                        id: mongo.ObjectId(items._id),
                        //step: 1,
                        message: trans,
                        image: img,
                        //transcript2: trans,
                        caller: req.query.caller_id,
                        callSid: req.query.sid,
                        recording_url: req.query.file,
                        //place_coord: place_coord,
                        created_at: new_date,
                        updated_at: new Date()

                      };
                      io.of('/'+req.params.channel).emit('message', msgs);
                    //});
                    


                });
                fs.createReadStream('./resources/'+filename).pipe(fs.createWriteStream('./resources/last.wav'));
                res.json(res2.results[0].alternatives[0].transcript);
              }
            }
          }); //end speech text
        }); //end st.on finish
        

      }); //end st.on response
    */
  });

router.route('/:channel/messages')
  .get(function(req, res){
    console.log('req: '+req.protocol+'://'+req.headers.host)

    async.waterfall([
      function(callback){
        db.reply_messages.find({channel: req.params.channel}).sort({created_at:-1}, function(err, items){
          if(err)
            res.send(err)

          callback(null, items)
        })
      },
      function(replies, callback){
        db.messages.find({channel: req.params.channel}).sort({created_at: -1}, function(err, items){
          if(err)
            res.send(err)

          var a = []
          items.forEach(function(v, k){
            items[k].messages = []
            replies.forEach(function(j, m){
              if(j.user_id == v._id.toString()){
                console.log('r: '+JSON.stringify(j))

                
                items[k].messages.push({message: j.message})
              }
            })
            
          })
          callback(null, items)
        })        
      }
      ],function(err,doc){

        res.json(doc)
    })

    /*db.messages.find({channel: req.params.channel}).sort({created_at: -1}, function(err, items){
      if(err)
        res.send(err);

    
      res.json(items)
    });*/
  })
  .post(function(req, res){
    console.log(JSON.stringify(req.body)+' '+JSON.stringify(req.params))
    //curl -X POST http://ACae6e420f425248d6a26948c17a9e2acf:ab727b37a3cd71713d663c4c27863de9@localhost/restcomm/2012-04-24/Accounts/ACae6e420f425248d6a26948c17a9e2acf/Calls.json -d "From=+601117227058" -d "To=+60122973281" -d "Url=http://139.59.41.98/restcomm/demos/hello-world.xml"

    db.reply_messages.insert({
      user_id: req.body.user_id,
      channel: req.params.channel,
      caller: req.body.caller,
      message: req.body.message,
      created_at: new Date()
    },function(err, items){
      if(err)
        res.send(err)

      request.post('http://'+restcomm_key+':'+restcomm_token+'@localhost/restcomm/2012-04-24/Accounts/'+restcomm_key+'/Calls.json',{
        form: {
          From: from,
          To: req.body.caller,
          Url: req.protocol+'://'+req.headers.host+'/api/'+req.params.channel+'/messages/'+req.body.user_id
        }
      }, function(error, response, body){
        console.log('url: '+req.protocol+'://'+req.headers.host+'/api/'+req.params.channel+'/messages/'+req.body.user_id)
        console.log(body);

        res.json(items)

      });

    })
  })

router.route('/:channel/audio')
  .get(function(req, res){
    db.messages.find({channel: req.params.channel}).sort({created_at: -1}).limit(1, function(err, item){
      var stat = fs.statSync(item[0].audio);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': stat.size
      })
      fs.createReadStream(item[0].audio).pipe(res);
      
    })
  })

router.route('/:channel/messages/:user_id')
  .post(function(req, res){
    console.log('masuk:')
    db.reply_messages.find({channel: req.params.channel, user_id: req.params.user_id}).sort({created_at: -1})
    .limit(1, function(err, item){

      res.set('Content-Type','application/xml')
      var xmlRes = {
        Response: [
          {
            Say: item[0].message
          }
        ]
      }
      res.send(xml(xmlRes))
    })
  })

router2.route('/:channel')
  .get(function(req, res){
    io.of('/'+req.params.channel).on('connection', function(socket){
      console.log('a user connected to channel: '+req.params.channel);

      socket.on('disconnect', function(){
        console.log('user disconnected');
      });

      socket.on('message', function(msg){
        console.log('message: ' + msg);
      });
    });

    res.render('demo',{
      channel: req.params.channel,
      root: __dirname
    })
  })

app.use('/api', router);
app.use(auth.connect(basic),router2);
//app.listen(port);
http.listen(port, function(){
  console.log('listening on *:'+port);
});