export class CircuitBreaker {
    constructor(options = {}) {
        this.threshold = options.threshold || 5; // pannes consécutives avant ouverture
        this.timeout = options.timeout || 30000; // durée de l'état "ouvert" en ms
        this.failures = 0;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = Date.now();
    }
    async call(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit ouvert - service indisponible, réessayez plus tard');
            }
            this.state = 'HALF_OPEN';
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }
    onSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }
    onFailure() {
        this.failures++;
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.timeout;
            console.error(`[CircuitBreaker] Circuit ouvert - ${this.failures} pannes
consécutives`);
        }
    }
}