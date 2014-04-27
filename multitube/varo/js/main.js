$(function(){
	var genURL = function(videos) {
	  var str = window.location.pathname;
	  var n = str.lastIndexOf('/');
	  var result = str.substring(n + 1);
	  if (videos == null || !videos.length || videos.length <= 0) {
		return;
	  }

	  return result + "?" + jQuery.param({ videos: videos });
	};
	
	$.getJSON("videos.json", function(data){
		var source   = $("#entry-template").html();
		var template = Handlebars.compile(source);
		var curColumn = 0;
		var curRow = 0;
		var columnCount = 3;
		var columnSize = (12/columnCount);
		var context = {
			teamRow: []
		};
		var columns = [];
		data.teams.forEach(function(entry){
			if(curColumn > columnCount-1){
				curColumn = 0;
				curRow++;
				columns = [];
			}
			if(context.teamRow[curRow] == null){
				context.teamRow[curRow] = {
					columns: columns
				};
			}
			entry.parts.forEach(function(part){
				part.url = genURL(part.ids);
			});
			entry.columnSize = columnSize;
			columns[curColumn] = entry;
			curColumn++;
		});
		var html = template(context);
		$("#entries").html(html);
	}).fail(function( jqxhr, textStatus, error ) {
		var err = textStatus + ', ' + error;
		console.log( "Request Failed: " + err);
    });
});