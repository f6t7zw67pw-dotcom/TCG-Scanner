import searchHandler from './cards/search.js';
import { enrichForeignNameInput } from './_i18n-name.js';

export default async function handler(req, res) {
  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    req.body = await enrichForeignNameInput(req.body);
  }
  return searchHandler(req, res);
}
