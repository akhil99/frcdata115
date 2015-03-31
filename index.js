var express = require('express');
var bodyParser = require('body-parser');
var tba = require('tba')('frc115', 'Scouting App', '0.1');
var firebase = require('firebase');

var ref = new firebase("https://scouting115.firebaseio.com");

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

app.get('/', function(request, response) {
  response.send('Hello World!');
});

app.post('/load-scores', loadScoresPOST);

app.post('/load-sched', loadSchedulePOST);

app.post('/load-teams', loadTeamsPOST);

app.get('/team-matchinfo', loadTeamMatchInfoGET);

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});

function loadSchedulePOST(request, res){
  var event = request.body.event;

  if(event == null){
      res.status(422).send('Missing event parameter');
      return;
  }

  tba.getEventMatches(event, function(error, data){
      var sched = ref.child('sched');
      for(var i in data){
        var match = data[i];
        var matchNo = match.comp_level + match.match_number;
        var blue = match.alliances.blue.teams;
        var red = match.alliances.red.teams;
        for(var b in blue){
          var team = blue[b];
          var id = team + '-' + event + ':' + matchNo;
          sched.child(id).set({
              alliance: 'b',
              event: event,
              match: matchNo,
              team: team,
          });
        }
        for(var r in red){
          var team = red[r];
          var id = team + '-' + event + ':' + matchNo;
          sched.child(id).set({
              alliance: 'r',
              event: event,
              match: matchNo,
              team: team,
          });
        }
      }
  });

  res.send('Attempted loading data from ' + event + '!');

}

function loadTeamsPOST(request, res){
  var event = request.body.event;

  if(event == null){
      res.status(422).send('Missing event parameter');
      return;
  }

  tba.getEventTeams(event, function(error, data){
      for(var i in data){
        var team = data[i];
        var key = team.key;
        ref.child('teams').child(key).set({
          name: team.name,
          nick: team.nickname,
          number: team.team_number,
          location: team.location,
          website: team.website
        });
      }
  });

  res.send('Attempted loading data from ' + event + '!');

}

function loadScoresPOST(request, res){
  var event = request.body.event;

  if(event == null){
      res.status(422).send('Missing event parameter');
      return;
  }

  tba.getEventMatches(event, function(error, data){
      var sched = ref.child('sched');
      for(var i in data){
        var match = data[i];
        var matchNo = match.comp_level + match.match_number;
        var key = event + ':' + matchNo;
        if(match.alliances.blue.score != null){
          var blueScore = match.alliances.blue.score;
          var redScore = match.alliances.red.score;
          var breakdown = match.score_breakdown;
          ref.child('scores').child(key).set({
            b: blueScore,
            r: redScore,
            breakdown: breakdown,
            event: event,
            match: matchNo
          });
        }
      }
  });

  res.send('Attempted loading scores for ' + event);

}

function loadTeamMatchInfoGET(request, res){

  var team = request.query.team;
  var event = request.query.event;

  if(event == null || team == null){
      res.status(422).send('Missing event parameter');
      return;
  }

  var matches = [];
  var sched = ref.child('sched');

  sched.once('value', function(snapshot){

    snapshot.forEach(function(childSnapshot) {
      var matchInfo = childSnapshot.val();
      if(matchInfo.team == team && matchInfo.event == event){
        matches.push(event + ':' + matchInfo.match);
      }
    });

    if(matches.length == 0){
      res.status(404).send('No matches found');
      return;
    }

    console.log(JSON.stringify(matches));
    res.send(JSON.stringify(matches));

  });

}
