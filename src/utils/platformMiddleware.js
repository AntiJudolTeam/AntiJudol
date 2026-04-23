import { getPlatform } from "../platforms.js";

export function resolvePlatform({ source = (req) => req.query.platform ?? req.params.platform, optional = false } = {}) {
  return (req, res, next) => {
    const name = source(req);
    if (!name) {
      if (optional) {
        req.platform = null;
        return next();
      }
      return res.status(400).send("Missing platform");
    }
    try {
      req.platform = getPlatform(name);
      req.platformName = name;
      next();
    } catch (err) {
      res.status(400).send(err.message);
    }
  };
}
