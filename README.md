<div align="center">
  <h1>♚ GrandMaster Ferb</h1>
  <p><i>A high-performance C++ Chess Engine & Interactive Web Application</i></p>

  ![C++](https://img.shields.io/badge/C++-17-blue.svg?style=flat-square)
  ![CMake](https://img.shields.io/badge/CMake-Build-green.svg?style=flat-square)
  ![Web](https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-orange.svg?style=flat-square)
</div>

---

**GrandMaster Ferb** is a dual-faceted chess project consisting of a blazing-fast C++ UCI chess engine (internally named *HagnusCarlsen*) and a beautifully crafted web-based chess application. Play against the AI, receive real-time coaching from "Coach Ferb", and review your games with detailed move-by-move analysis!

## 🌟 Key Features

### ⚙️ The C++ Engine Core
The engine is built from scratch in modern C++17 with a strict focus on low-level optimization and advanced chess programming techniques:
- **Bitboards**: Lightning-fast move generation and board representation using 64-bit integers.
- **Advanced Search**: Negamax framework heavily optimized with Alpha-Beta pruning to explore millions of positions per second.
- **Transposition Tables**: 512 MB Zobrist-hashing table to cache previously evaluated positions and exponentially speed up search depth.
- **Move Ordering**: Sophisticated heuristics to evaluate the most promising moves first, maximizing alpha-beta cutoffs.
- **Opening Books**: Integrated polyglot opening database support (`white.bin` & `black.bin`) for solid, theory-backed early-game play.
- **UCI Protocol**: Fully compliant with the Universal Chess Interface, allowing seamless integration with standard GUIs like Arena, Cute Chess, or Nibbler.

### 🌐 The Web Application (`chess-web`)
A sleek, responsive frontend built with HTML, CSS, and Vanilla JavaScript to bring the game to life:
- **Interactive Gameplay**: Play against different AI difficulty levels (🌱 Newbie, ♟️ Beginner, ⚔️ Intermediate, 🏆 Advanced).
- **Flexible Time Controls**: Supports Bullet, Blitz, and Rapid time formats.
- **Real-Time Coaching**: "Coach Ferb" provides in-game conversational feedback and a comprehensive post-game review summary.
- **Game Review Mode**: Step through your game move-by-move to analyze mistakes, blunders, and missed opportunities.
- **Evaluation Bar**: Visual, real-time indicator of positional advantage.

---

## 🛠️ Architecture & Project Structure

The repository is elegantly divided into two primary environments:

1. **C++ Engine (`/`, `src/`)**: 
   - `bitboard.cpp/h`: Low-level bitwise operations and masks.
   - `search.cpp`, `negamax.cpp`: The AI decision-making core.
   - `evaluate.cpp/h`: Static position evaluation logic.
   - `transposition.cpp/h`, `zobrist.cpp`: State caching and hashing.
   - `main.cpp`: Entry point handling UCI I/O and thread pooling.
   
2. **Web GUI (`chess-web/`)**: 
   - `index.html`: The main application view.
   - `js/`: Contains the frontend logic (`ai-engine.js`, `board-ui.js`, `bot-chat.js`).
   - `css/` & `img/`: Styling and assets for a premium feel.

---

## 🚀 Getting Started

### Prerequisites
- A modern C++17 compiler (GCC / Clang / MSVC)
- CMake (3.14+)

### Building the C++ Engine

The project uses CMake to orchestrate the build process:

```bash
# Clone the repository
git clone https://github.com/Abhijeet1815/GrandMaster-Ferb.git
cd GrandMaster-Ferb

# Create a build directory
mkdir build && cd build

# Configure and compile
cmake ..
make -j$(nproc)
```
*(Note: You can build optional benchmarks and tests using `-DBUILD_BENCHMARKS=ON` or `-DBUILD_TESTS=ON`)*

This will produce the `HagnusCarlsen` executable.

### Running the Web Interface

Navigate to the `chess-web` directory and open `index.html` in your favorite browser, or serve it using a local HTTP server:

```bash
cd chess-web
npx http-server .
```
Visit `http://localhost:8080` to start playing!

---

## 🎮 Command Line Usage (UCI Mode)

If you wish to use the engine via command line or plug it into a chess GUI:
1. Run `./build/HagnusCarlsen`
2. Initialize engine: `uci`
3. Check readiness: `isready`
4. Set position: `position startpos` or `position fen <FEN>`
5. Start thinking: `go depth 5` or `go movetime 1000`

---

## 🤝 Contributing
Contributions, bug reports, and feature requests are always welcome! Whether it's optimizing the move generator, refining the evaluation weights, or beautifying the web interface, feel free to open a Pull Request.
