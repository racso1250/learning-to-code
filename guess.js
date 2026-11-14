// Pick a secret random number from 1 to 100
let secretNumber = Math.floor(Math.random() * 100) + 1;

// Count how many guesses the player has made
let guesses = 0;

// Find the parts of the page we need to use
const input = document.getElementById("guess-input");
const guessButton = document.getElementById("guess-button");
const message = document.getElementById("message");
const count = document.getElementById("count");
const playAgainButton = document.getElementById("play-again");

// This runs every time the player makes a guess
function checkGuess() {
  const guess = Number(input.value);

  // Make sure the guess is a number from 1 to 100
  if (guess < 1 || guess > 100) {
    message.textContent = "Pick a number from 1 to 100!";
    return;
  }

  guesses = guesses + 1;
  count.textContent = "Guesses: " + guesses;

  if (guess === secretNumber) {
    message.textContent = "You got it! The number was " + secretNumber + "!";
    guessButton.disabled = true;
    playAgainButton.hidden = false;
  } else if (guess < secretNumber) {
    message.textContent = guess + " is too low! Try higher.";
  } else {
    message.textContent = guess + " is too high! Try lower.";
  }

  // Clear the box so the player can type the next guess
  input.value = "";
  input.focus();
}

// This starts a brand new game
function playAgain() {
  secretNumber = Math.floor(Math.random() * 100) + 1;
  guesses = 0;
  count.textContent = "Guesses: 0";
  message.textContent = "Can you guess it?";
  guessButton.disabled = false;
  playAgainButton.hidden = true;
  input.focus();
}

// Run checkGuess when the Guess button is clicked
guessButton.addEventListener("click", checkGuess);

// Also run checkGuess when the player presses Enter
input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    checkGuess();
  }
});

// Run playAgain when the Play again button is clicked
playAgainButton.addEventListener("click", playAgain);
