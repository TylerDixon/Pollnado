from flask import Flask
from flask import send_file
app = Flask(__name__)

@app.route("/")
def hello():
    return send_file("app/index.html");

if __name__ == "__main__":
    app.run()