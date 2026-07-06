import readline from "node:readline";

export function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

export function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");

    let value = "";
    const onData = (char) => {
      const code = char.charCodeAt(0);

      if (char === "\n" || char === "\r") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (code === 3) {
        process.exit(1); // Ctrl-C
      }
      if (code === 127 || code === 8) {
        value = value.slice(0, -1); // Backspace
        return;
      }
      value += char;
    };
    stdin.on("data", onData);
  });
}
