export const add = (a, b) => {
  return a + b;
};

export const adding = async (a, b) => {
  return new Promise(function (resolve) {
    resolve(a + b);
  });
};

export const divide = (a, b) => {
  if (b === 0) {
    throw new Error('Cannot divide by zero');
  }
  return a / b;
};

export const reverse = (list) => {
  const result = [];
  for (let i = list.length - 1; i >= 0; --i) {
    result.push(list[i]);
  }
  return result;
};
