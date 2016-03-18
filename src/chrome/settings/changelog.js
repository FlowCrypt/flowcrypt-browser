
$.get('/changelog.txt', null, function(data) {
  $('#changelog').html(data.replace(/\n/g, '<br>'));
})
