var pollsApp = angular.module('Polls', ['ngAnimate']).config(['$interpolateProvider', function ($interpolateProvider) { 
    $interpolateProvider.startSymbol('[['); 
    $interpolateProvider.endSymbol(']]'); 
  }]);
pollsApp.controller('NewPollCtrl', ['$scope','$http', function($scope, $http){
	$http.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
	$scope.posts = [];
	$scope.questions = [];
	var undoQuestionRemove = [];
	$scope.removeQuestion = function(index){
		undoQuestionRemove.push($scope.questions.splice(index, 1));
	}
	$scope.addQuestion = function(){
		$scope.questions.push({answers:[]})
	}
	$scope.addAnswer = function(index){
		$scope.questions[index].answers.push({});
	}
	$scope.removeAnswer = function(qIndex, aIndex){
		undoQuestionRemove.push($scope.questions[qIndex].answers.splice(aIndex, 1));
	}
	$scope.moveUp = function(index){
		var temp = $scope.questions[index];
		$scope.questions[index] = $scope.questions[index-1]
		$scope.questions[index-1] = temp;
	}
	$scope.moveDown = function(index){
		var temp = $scope.questions[index];
		$scope.questions[index] = $scope.questions[index+1]
		$scope.questions[index+1] = temp;
	}
	$scope.dewarn = function(contentType){
		if(contentType.warning){
			contentType.watcher = $scope.$watch(function(){return contentType.content}, function(value){
				if(value){
					contentType.warning = '';	
					contentType.watcher();
				}
			})			
		}
	}
	$scope.send = function(message){
		var error = false;
		if(!$scope.pollName){
			$scope.pollNameWarning = "You need a poll name!"
			error = true;
		}
		for(var index in $scope.questions){
			var question = $scope.questions[index];
			if(!question.content){
				question.warning = "You need a question! C'MON!";
				error = true;
			}
			for(var aIndex in question.answers){
				if(!question.answers[aIndex].content){
					question.answers[aIndex].warning = "COME ON MAN";
					error = true;
				}
			}
		}
		if(!error){
		var data = {
		  	poll: {
	  			pollname: $scope.pollName, 
	  			questions:$scope.questions
			}, 
			_xsrf: getCookie("_xsrf")
		}
		$.ajax({
		  type: "POST",
		  url: '/newpoll',
		  data: angular.toJson(data),
		  success: function(data){
			window.location.href = "http://localhost:" + data.port + "/poll/"+data.pollId;
		  }
		});

		}
	}
	function getCookie(name) {
	    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
	    return r ? r[1] : undefined;
	}
}]);

pollsApp.controller('ParentCtrl', ['$scope',function($scope){
	$scope.displayPoll = false;
	$scope.display = function(){
		$scope.displayPoll = true;		
	}
}]);

pollsApp.controller('PollCtrl', ['$scope','$http', function($scope, $http){
	$http.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
	$scope.$parent.pollId = pollId;
	$scope.answers = [];
	$scope.votes = {};
	var globalVotes = [];
	$.ajax({
	  type: "GET",
	  url: '/getPoll/'+pollId,
	  success: function(data){
	  	$scope.$apply(function(){
  			$scope.pollData = angular.fromJson(data).pollData;
  			for(poll in $scope.pollData.questions){
  				var questions = $scope.pollData.questions[poll];
  				for(answer in questions.answers){
  					$scope.answers[questions.answers[answer].id] = questions.answers[answer];
  					globalVotes.push({"answer":questions.answers[answer].content, "votes":questions.answers[answer].votes})
  				}
  			}
  			createPie(globalVotes);
	  	});
	  }
	});
	$scope.vote = function(){
		var votes = [];
		for(var vote in $scope.votes){
			votes.push($scope.votes[vote]);
		}
		$.ajax({
		  type: "POST",
		  url: '/vote/',
		  data: angular.toJson({
		  	votes: votes, 
		  	poll_id: pollId,
			_xsrf: getCookie("_xsrf")
		  }),
		  success: function(data){
		  	$scope.$apply(function(){
		  		$scope.votes = {};
		  	})
		  }
		});		
		$scope.voted = true;
	}
	$scope.viewResults = function(){
		$scope.voted = true;
	}
	function getCookie(name) {
	    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
	    return r ? r[1] : undefined;
	}
	var updater = {
		errorSleepTime: 500,
		cursor: null,
		poll: function(){
	        var args = {"_xsrf": getCookie("_xsrf")};
	        if (updater.cursor) args.cursor = updater.cursor;
	        $.ajax({url: "/update/"+pollId, type: "POST", dataType: "text",
	                data: $.param(args), success: updater.onSuccess,
	                error: updater.onError});
		},
		onSuccess: function(response) {
			var votes = angular.fromJson(response).votes;
			debugger;
	        if(response){
	        	$scope.$apply(function(){
					for(var x=0; x<votes.length; x++){
						$scope.answers[votes[x]].votes++;
				        for(var y=0; y<globalVotes.length; y++){
				        	
				        	if($scope.answers[votes[x]] &&globalVotes[y].answer === $scope.answers[votes[x]].content){
				        		globalVotes[y].votes++;
				        		break;
				        	}
				        }

					}
	        	});
	        	debugger;
	        	g = g.data(pie(globalVotes));
	        	// svg.selectAll(".arc").data(globalVotes).selectAll("path").attr("d", arc)
	        		        	// createPie(globalVotes);

	        } 
	        updater.errorSleepTime = 500;
	        window.setTimeout(updater.poll, 0);
	    },

	    onError: function(response) {
	        updater.errorSleepTime *= 2;
	        console.log("Poll error; sleeping for", updater.errorSleepTime, "ms");
	        window.setTimeout(updater.poll, updater.errorSleepTime);
	    }
	}

	updater.poll();



var width = 960,
    height = 500,
    radius = Math.min(width, height) / 2;

var color = d3.scale.ordinal()
    .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

var arc = d3.svg.arc()
    .outerRadius(radius - 10)
    .innerRadius(0);

var pie = d3.layout.pie()
    .sort(null)
    .value(function(d) { return d.votes; });

var svg = d3.select("#test").append("svg")
    .attr("width", width)
    .attr("height", height)
  .append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
    var g;
function createPie(data){
	
  data.forEach(function(d) {
    d.votes = +d.votes;
  });

  g = svg.selectAll(".arc")
      .data(pie(data))
    .enter().append("g")
      .attr("class", "arc");

  g.append("path")
      .attr("d", arc)
      .style("fill", function(d) {  return color(d.data.answer); });

  g.append("text")
      .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
      .attr("dy", ".35em")
      .style("text-anchor", "middle")
      .text(function(d) { return d.data.answer; });


}






}]);