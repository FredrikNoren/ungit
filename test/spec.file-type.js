const fileType = require('../src/utils/file-type.js');
const expect = require('expect.js');

describe('file type', () => {
  it('should be able to detrmine image file vs text files.', () => {
    expect(fileType('example.txt')).to.be('text');
    expect(fileType('example')).to.be('text');
    expect(fileType('example.aBc')).to.be('text');
    expect(fileType('examplepng.jpg.er')).to.be('text');

    expect(fileType('example.png')).to.be('image');
    expect(fileType('example.jpg')).to.be('image');
    expect(fileType('example.bmp')).to.be('image');
    expect(fileType('example.gIf')).to.be('image');
    expect(fileType('example.JPEG')).to.be('image');
  });
});
