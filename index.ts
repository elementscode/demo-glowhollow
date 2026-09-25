import { App } from "@elements/app";
import config from "#config";
import home from "#app/pages/home";
import signin from "#app/pages/signin";
import signup from "#app/pages/signup";
import channel from "#app/pages/channel";
import admin from "#app/pages/admin";
import serveImage from "#app/routes/images";
import { clearThisHost } from "#app/shared/services/presence";
import notFound from "#app/pages/errors/not-found";
import unhandled from "#app/pages/errors/unhandled";

const app = new App();

app.route("/", home);
app.route("/signin", signin);
app.route("/signup", signup);
app.route("/c/:id", channel);
app.route("/admin", admin);
app.route("/images/:id/:hash", serveImage);

app.error((req, res, err) => {
  switch (err.statusCode) {
    case 404:
      return notFound(req, res, err);

    default:
      return unhandled(req, res, err);
  }
});

app.start(config);

// Presence rows this host left behind when it last stopped.
clearThisHost();
