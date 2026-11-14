// A list (called an "array") of all the moves
const moves = ["rock", "paper", "scissors"];

// A picture for each move
const pictures = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

// Keep score
let playerScore = 0;
let computerScore = 0;

// Find the parts of the page we need to use
const battle = document.getElementById("battle");
const message = document.getElementById("message");
const score = document.getElementById("score");

// Pick a random move for the computer and give it back
function getComputerMove() {
  const randomIndex = Math.floor(Math.random() * moves.length);
  return moves[randomIndex];
}

// Work out who won: "player", "computer" or "draw"
function getWinner(playerMove, computerMove) {
  if (playerMove === computerMove) {
    return "draw";
  }

  if (
    (playerMove === "rock" && computerMove === "scissors") ||
    (playerMove === "paper" && computerMove === "rock") ||
    (playerMove === "scissors" && computerMove === "paper")
  ) {
    return "player";
  }

  return "computer";
}

// Play one round, using the move the player picked
function play(playerMove) {
  const computerMove = getComputerMove();
  const winner = getWinner(playerMove, computerMove);

  battle.textContent = pictures[playerMove] + " vs " + pictures[computerMove];

  if (winner === "player") {
    playerScore = playerScore + 1;
    message.textContent = "You win! " + playerMove + " beats " + computerMove + ".";
  } else if (winner === "computer") {
    computerScore = computerScore + 1;
    message.textContent = "You lose! " + computerMove + " beats " + playerMove + ".";
  } else {
    message.textContent = "It's a draw!";
  }

  score.textContent = "You: " + playerScore + "   Computer: " + computerScore;
}

// When a button is clicked, play a round with that move
document.getElementById("rock-button").addEventListener("click", function () {
  play("rock");
});

document.getElementById("paper-button").addEventListener("click", function () {
  play("paper");
});

document.getElementById("scissors-button").addEventListener("click", function () {
  play("scissors");
});
