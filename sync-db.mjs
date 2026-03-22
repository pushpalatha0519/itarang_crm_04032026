import { spawn } from 'child_process';

const child = spawn('npx', ['drizzle-kit', 'push'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  shell: true
});

const sendInputs = () => {
  const intervals = [10000, 12000, 14000, 16000, 18000, 20000, 22000, 24000, 26000, 28000];
  intervals.forEach((delay, index) => {
    setTimeout(() => {
      if (child.stdin.writable) {
        child.stdin.write('\n');
        console.log(`Sent newline ${index + 1}`);
      }
    }, delay);
  });
  
  setTimeout(() => {
    if (child.stdin.writable) {
      child.stdin.end();
    }
  }, 30000);
};

sendInputs();

child.on('exit', (code) => {
  console.log(`Exited with code ${code}`);
  process.exit(code || 0);
});
