import logging
import json
from tornado.wsgi import WSGIContainer
import tornado.web
import torndb
from tornado.ioloop import IOLoop
import os

db = torndb.Connection("localhost:3306", "pollnado",
	user="root", password="root")

port = 8000

class VoteBuffer(object):
	def __init__(self):
		self.callbacks = {};
	def register_watcher(self, callback, poll_id, cursor=None):
		poll_id = str(poll_id)
		if not hasattr(self.callbacks, poll_id):
			self.callbacks[poll_id] = []
		self.callbacks[poll_id].append(callback)

	def wait_for_votes(self, callback, cursor=None):
		self.callbacks.add(callback)
	def cancel_wait(self, callback, poll_id):
		self.callbacks[poll_id].remove(callback)
	def new_votes(self, votes, poll_id):
		fns = self.callbacks[str(poll_id)]
		for fn in fns:
			fn(votes)
		string = "UPDATE answers SET votes = votes + 1 WHERE"
		numVotes = 0;
		for vote in votes:
			if numVotes > 0:
				string += (" OR id = "+str(vote)+"")
			else:
				string += (" id = "+str(vote)+"")
			numVotes+=1
		db.execute(string)

class Poll():
	def __init__(self, poll_id):
		if poll_id is not None:
			self.results = db.query("select * FROM pollnado.polls i INNER JOIN pollnado.questions a ON a.poll_id = i.id INNER JOIN pollnado.answers b ON b.question_id = a.id WHERE (i.id=%s)", poll_id)
			self.pollname = self.results[0].name
			self.questions = []
			for result in self.results:
				found = False
				for question in self.questions:
					if question["id"] == result.question_id:
						found = True
				if not found:
					self.questions.append(
						{
						"id":result.question_id,
						"content":result.content, 
						"content_type":result.content_type, 
						"answers":[{"content":result.answer_content, "content_type":result.answer_content_type, "votes":result.votes, "id":result.id,},],},
						)
				if found:
					question["answers"].append({"content":result.answer_content, "content_type":result.answer_content_type, "votes":result.votes, "id":result.id,})
			self.poll = {"pollname": self.pollname, "questions":self.questions,}

	def CreatePoll(self, pollname, questions):
		self.poll_id = db.execute("INSERT INTO polls (name) VALUES (%s)", pollname)
		self.answers = []
		for question in questions:
			# print question
			questionId = db.execute("INSERT INTO questions (poll_id, content, content_type, question_type) VALUES (%s, %s, %s, %s)", self.poll_id, question["content"], 'string', 'single')
			# print questionId
			for answer in question["answers"]:
				print answer
				db.execute("INSERT INTO answers (question_id, answer_content, answer_content_type) VALUES (%s, %s, %s)", questionId, answer["content"], 'string')
		return self.poll_id


global_vote_buffer = VoteBuffer()

class MainHandler(tornado.web.RequestHandler):
	def get(self):
		self.render("app/index.html", template="templates/new_poll.html", pollId='undefined')

class PostHandler(tornado.web.RequestHandler):
	def post(self):
		message = {
			"data": self.get_argument('sent'),
		}
		global_vote_buffer.new_votes([message])

class UpdateHandler(tornado.web.RequestHandler):
   	@tornado.web.asynchronous
	def post(self, poll_id):
		self.poll_id = poll_id
		global_vote_buffer.register_watcher(self.on_new_votes, poll_id=poll_id)
	def on_new_votes(self, votes):
		if self.request.connection.stream.closed():
			return
		self.finish(dict(votes=votes))
	def on_connection_close(self):
		global_vote_buffer.cancel_wait(self.on_new_votes, self.poll_id)

class NewPollHandler(tornado.web.RequestHandler):
	@tornado.web.asynchronous
	def post(self):
		data = tornado.escape.json_decode(self.request.body)
		pollData = data["poll"]
		poll = Poll(None)
		poll_id = poll.CreatePoll(pollData["pollname"], pollData["questions"]);
		self.finish(dict(pollId=poll_id, port=port))

class PollHandler(tornado.web.RequestHandler):
	def get(self, poll_id):
		self.render("app/index.html", template="templates/poll.html", pollId=poll_id);

class PollReturnHandler(tornado.web.RequestHandler):
	def get(self, poll_id):
		self.pollData = Poll(poll_id)
		self.finish(dict(pollData=self.pollData.poll))

class VoteHandler(tornado.web.RequestHandler):
	def post(self):
		data = tornado.escape.json_decode(self.request.body)
		votes = data["votes"]
		poll_id = data["poll_id"]
		global_vote_buffer.new_votes(votes, poll_id)


poll_id = 1
def main():
	app = tornado.web.Application(
		[
			(r"/", MainHandler),
			(r"/update/(.*)", UpdateHandler),
			(r"/post", PostHandler),
			(r"/newpoll", NewPollHandler),
			(r'/poll/(.*)', PollHandler),
			(r'/getPoll/(.*)', PollReturnHandler),
			(r'/vote/', VoteHandler),
		],
		debug=True,
		static_path=os.path.join(os.path.dirname(__file__), "app/static"),
    	xsrf_cookies= False,
	)
	app.listen(port)
	IOLoop.instance().start()

if __name__ == "__main__":
    main()