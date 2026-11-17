const { spawn, execFileSync } = require('node:child_process'), fs = require('node:fs');
(async () => { const log = fs.openSync('work/financial-package-browser-fixture.log', 'w'), child = spawn(process.execPath, ['--import', 'tsx', 'backend/tests/serve-financial-package-fixture.ts'], { stdio: ['ignore', log, log] }); fs.closeSync(log); try {
    let ready = false;
    for (let i = 0; i < 90; i++) {
        if (child.exitCode !== null)
            throw Error('SYNTHETIC_FINANCIAL_FIXTURE_STOPPED');
        try {
            const r = await fetch('http://127.0.0.1:3646/api/health');
            ready = r.ok;
            await r.body?.cancel();
        }
        catch { }
        if (ready)
            break;
        await new Promise(r => setTimeout(r, 1000));
    }
    if (!ready)
        throw Error('SYNTHETIC_FINANCIAL_FIXTURE_NOT_READY');
    execFileSync(process.execPath, ['backend/tests/financial-package.browser.cjs'], { stdio: 'inherit' });
}
finally {
    child.kill('SIGTERM');
    if (child.exitCode === null)
        await new Promise(r => child.once('exit', r));
} })().catch(e => { console.error(e.message); process.exitCode = 1; });
