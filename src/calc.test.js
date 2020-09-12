import * as calc from './calc.js';
import '../node_modules/chai/chai.js';

const { expect } = chai;

describe('calc', function () {
  describe('add', function () {
    it('should sum 2 and 3 to 5', function () {
      expect(calc.add(2, 3)).to.equal(5);
    });
  });

  describe('reverse', function () {
    it('should turn the array upside down', function () {
      expect(calc.reverse([1, 2, 3])).to.deep.equal([3, 2, 1]);
    });
  });

  describe('divide', function () {
    it('should verify approximately one third', function () {
      expect(calc.divide(5, 3)).to.be.approximately(1.66, 0.01);
    });

    describe('broken precondition', function () {
      it('should throw an Error', function () {
        expect(function () {
          calc.divide(1, 0);
        }).to.throw('Cannot divide by zero');
      });
    });
  });

  describe('adding', function () {
    it('should eventually sum 2 and 3 to 5', async function () {
      const result = await calc.adding(2, 3);
      expect(result).to.equal(5);
    });
  });
});
