var ref = new Firebase('https://scouting115.firebaseio.com/');

ref.child('pitscout/images').on("child_added", function(snapshot) {
  var img = snapshot.val();

  var container = $('#pitmedia');

  console.log('child added');
  console.log(img.team);
  console.log(img.url);
  console.log(img.msg);

  var html =
  '<div class ="mediaItem"><img src="' + img.url + '" width="400px" height="250px"/>' +
  '<h4 class="teamcaption">Team ' + img.team + '</h4><h4 class="caption">' + img.msg + '</h4></div>'

  container.append(html);

});
