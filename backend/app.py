from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route("/api/hello")
def hello() -> tuple[dict[str, str], int]:
    """Return a hello-world payload proving the backend is reachable.

    Returns:
        A JSON-serializable dict with a "message" key, and HTTP 200.
    """
    return jsonify(message="Hello from Flask"), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
