const SVG_NS = "http://www.w3.org/2000/svg";

/*class Vector {
    x;
    y;

    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        return new Vector(this.x + v.x, this.y + v.y);
    }

    sub(v) {
        return new Vector(this.x - v.x, this.y - v.y);
    }

    mul(s) {
        return new Vector(this.x * s, this.y * s);
    }

    abs() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    norm() {
        return this.mul(1 / this.abs());
    }
}*/

class Vector {
    static add(a, b) {
        return new DOMPoint(a.x + b.x, a.y + b.y);
    }

    static sub(a, b) {
        return new DOMPoint(a.x - b.x, a.y - b.y);
    }

    static dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }

    /*static cross(a, b) {
            // a2 0 - 0 b2
            // a1 0 - 0 b1
            // a1 b2 - a2 b1
            // b.x  b.y
            // b.y -b.x
            // dot(a, getNormal(b));
            // a.x * b.x + a.y * b.y;
            // a.x * b.y + a.y * -b.x;
            // (a.x * b.y) - (a.y * b.x)
        // return a.y * b.x - a.x * by;
    }*/

    static mul(v, s) {
        return new DOMPoint(v.x * s, v.y * s);
    }

    static abs(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    static norm(v) {
        return Vec.mul(v, 1 / Vec.abs(v));
    }

    static getNormal(v) {
        return new DOMPoint(-v.y, v.x);
    }
}

class SVG {
    static makeLine(p1, p2) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", p1.x);
        line.setAttribute("y1", p1.y);
        line.setAttribute("x2", p2.x);
        line.setAttribute("y2", p2.y);
        return line;
    }

    static makeRect(p, width, height, {fill} = {}) {
        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", p.x);
        rect.setAttribute("y", p.y);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        if (fill) {
            rect.style.fill = fill;
        }
        return rect;
    }

    static make(tagName, attributes = {}) {
        const node = document.createElementNS(SVG_NS, tagName);
        for (let [name, value] of Object.entries(attributes)) {
            node.setAttribute(name, value);
        }
        return node;
    }
};

const Vec = Vector;

class Polygon {
    vertices;

    static fromRect(x, y, width, height) {
        return new Polygon([
            new DOMPoint(x, y), new DOMPoint(x, y + height), new DOMPoint(x + width, y + height),
            new DOMPoint(x + width, y)
        ]);
    }

    constructor(vertices) {
        this.vertices = vertices;
    }

    get edges() {
        return this.vertices.map((v, i) => [v, this.vertices[(i + 1) % this.vertices.length]]);
    }

    transform(matrix) {
        return new Polygon(this.vertices.map(v => matrix.transformPoint(v)));
    }
}

class UI extends HTMLElement {
    ship;
    #thrusters;

    t;
    #keys = new Set();
    #control = new DOMPoint();

    #entities = [];
    #joints = new Set();
    #annotations = new Map();

    #options = {rotateCam: true, debug: false, cruise: true};
    #info;

    #second;
    #frames = 0;
    #fps = 0;
    #annotationLayer;
    #entityLayer;

    #abg = "- nothing";
    #calibration = null;
    paused = true;

    //static ENGINE = 9.80665 * 5; // m / s2
    //static TARGET_VELOCITY = 150; // m / s ; reached in 3s
    //static ENGINE = 9.80665 * 5; // m / s2
    //static TARGET_VELOCITY = 100; // m / s ; reached in 2s
    //static ENGINE = 9.80665 * 1.67; // m / s2
    //static TARGET_VELOCITY = 50; // m / s ; reached in 3s

    //static ENGINE = 9.80665 * 5; // m / s2
    //static TARGET_VELOCITY = 50; // m / s ; reached in 1s
    static ENGINE = 9.80665 * 2.5; // m / s2
    static TARGET_VELOCITY = 50; // m / s ; reached in 2s

    constructor() {
        super();

        document.addEventListener("keydown", event => {
            switch (event.key) {
            case "c":
                this.#options.rotateCam = !this.#options.rotateCam;
                break;
            case "d":
                this.#options.debug = !this.#options.debug;
                break;
            case "s":
                this.#options.cruise = !this.#options.cruise;
                break;
            case "p":
                if (this.paused) {
                    this.play();
                } else {
                    this.pause();
                }
                break;
            case "ArrowLeft":
            case "ArrowRight":
            case "ArrowUp":
            case "ArrowDown":
                if (this.paused) {
                    this.play();
                }
                break;
            case "Shift":
                if (this.ship.joint) {
                    // XXX copypasta
                    if (this.#options.debug) {
                        this.#annotations.get(this.ship.joint).remove();
                    }
                    this.#joints.delete(this.ship.joint);
                    this.ship.joint = null;
                }
            }
        });

        for (let type of ["keydown", "keyup"]) {
            document.addEventListener(type, event => {
                if (type === "keydown") {
                    this.#keys.add(event.key);
                } else {
                    this.#keys.delete(event.key);
                }

                let x, y;
                if (this.#keys.has("ArrowLeft")) {
                    x = 1;
                } else if (this.#keys.has("ArrowRight")) {
                    x = -1;
                } else {
                    x = 0;
                }
                if (this.#keys.has("ArrowUp")) {
                    y = 1;
                } else if (this.#keys.has("ArrowDown")) {
                    y = -1;
                } else {
                    y = 0;
                }
                this.#control = new DOMPoint(x, y);
            });
        }

        addEventListener("deviceorientation", event => {
            if (!this.#calibration) {
                this.#calibration = {beta: event.beta, gamma: event.gamma};
            }
            let beta = event.beta - this.#calibration.beta;
            let gamma = event.gamma - this.#calibration.gamma;
            this.#abg =  `${beta.toFixed(1)} ${gamma.toFixed(1)}`;
            // this.#abg =  `${event.alpha.toFixed(1)} ${event.beta.toFixed(1)} ${event.gamma.toFixed(1)}`;
            const OFFSET = 2; // accel and spinning should be possible without each other
            const RANGE = 10 - OFFSET; // neigung for maximum acceleration should feel convenient
            if (Math.abs(beta) < OFFSET) {
                beta = 0;
            } else {
                beta = beta - Math.sign(beta) * OFFSET;
                // beta = Math.sign(beta) * RANGE;
            }
            if (Math.abs(gamma) < OFFSET) {
                gamma = 0;
            } else {
                gamma = gamma - Math.sign(gamma) * OFFSET;
                // gamma = Math.sign(gamma) * RANGE;
            }
            /*else {
                beta = Math.sign(beta) * 15;
            }
            else {
                gamma = Math.sign(gamma) * 15;
            }*/
            const x = Math.max(Math.min(-beta / RANGE, 1), -1);
            const y = Math.max(Math.min(gamma / RANGE, 1), -1);
            this.#control = new DOMPoint(x, y);
            /*if (event.gamma >= -40) {
                this.#control = new DOMPoint(0, 1);
            } else {
                this.#control = new DOMPoint(0, 0);
            }*/
        });
        //dispatchEvent(new CustomEvent("deviceorientation"));

        const checkOrientation = () => {
            this.classList.toggle("fleet-orientation", innerWidth < innerHeight);
        }
        checkOrientation();
        addEventListener("resize", checkOrientation);
    }

    play() {
        this.classList.remove("paused");
        this.#calibration = null;
        this.paused = false;
    }

    pause() {
        this.classList.add("paused");
        this.paused = true;
    }

    connectedCallback() {
        setTimeout(() => {
            this.querySelector(".play").addEventListener("click", async () => {
                await document.body.requestFullscreen();
                this.play();
            });

            this.addEventListener("click", () => {
                if (this.paused) {
                    this.play();
                } else {
                    this.pause();
                }
            });

            this.canvas = this.querySelector("g");
            this.#entityLayer = this.canvas.querySelector(".entities");
            this.#annotationLayer = this.querySelector(".annotations");
            this.#entities = Array.from(
                this.querySelectorAll(".object"),
                path => {
                    const bbox = path.getBBox();
                    return new Entity(
                        // path, Polygon.fromRect(bbox.x, bbox.y, bbox.width, bbox.height), 10000
                        path,
                        new Polygon(
                            // TODO fix hexagon better
                            [new DOMPoint(-2, -4), new DOMPoint(-2, 0), new DOMPoint(-1, 4),
                             new DOMPoint(1, 4),
                             new DOMPoint(2, 0), new DOMPoint(2, -4)]),
                        10000
                    );
                }
            );
            //this.#entities[0].pos = new Vector(100, 200);
            this.#info = this.querySelector(".info");
            this.ship = this.#entities[this.#entities.length - 1];
            this.#thrusters = this.ship.node.querySelectorAll(".thruster");

            this.init();
            this.t = new Date();
            this.#second = this.t;
            requestAnimationFrame(() => this.step());
            //this.play();
        }, 0);
    }

    init() {
        this.#createShip();
        this.#createContainer(new DOMPoint(0, 50 + 8 + 2.5 / 2));
        this.#createContainer(new DOMPoint(-10, 70 + 8 + 2.5 / 2));
        this.#createContainer(new DOMPoint(10, 90 + 8 + 2.5 / 2));
    }

    #createShip() {
        // const decks = 20 + Math.floor(Math.random() * (10 + 1));
        const decks = 70 + Math.floor(Math.random() * (10 + 1));
        const cells = 20 + Math.floor(Math.random() * (10 + 1));

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); // new SVGRectElement();

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); // new SVGRectElement();
        g.append(rect);

        const width = cells * 4 + 2;
        const height = decks * 4 + 2;
        const left = -width / 2;
        const bottom = -height / 2;
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("x", left);
        rect.setAttribute("y", bottom);
        rect.setAttribute("rx", 1);
        rect.setAttribute("ry", 1);
        rect.style.fill = "silver";
        for (let y = 0; y < decks; y++) {
            for (let x = 0; x < cells; x++) {
                const w = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                w.setAttribute("width", 2);
                w.setAttribute("height", 1);
                w.setAttribute("x", left + 4 * x + 1 + 1);
                w.setAttribute("y", bottom + 4 * y + 2 + 1);
                /*w.setAttribute("rx", 0.25);
                w.setAttribute("ry", 0.25);*/
                w.style.fill = Math.random() <= 2 / 3 ? "yellow" : "#333";
                g.append(w);
            }
        }

        this.canvas.querySelector(".entities").append(g);
        const entity = new Entity(g, Polygon.fromRect(left, bottom, width, height), Infinity);
        entity.update(new DOMPoint(100, 100), 0);
        //entity.pos = new Vector(-left, 0);
        // entity.v = new Vector(0, 10);
        // entity.vRot = Math.PI / 8;
        this.#entities.push(entity);
    }

    #createContainer(position) {
        // https://en.wikipedia.org/wiki/Intermodal_container
        const width = 6; // 12
        const height = 2.5; // 16
        const rect = SVG.makeRect(
            new DOMPoint(-width / 2, -height / 2), width, height, {fill: "silver"}
        );
        const shape = Polygon.fromRect(-width / 2, -height / 2, width, height);
        const container = new Entity(rect, shape, 2.5 * 1000); // 1);
        container.update(position, 0);
        this.#entityLayer.append(rect);
        this.#entities.push(container);
        return container;
    }

    step() {
        const now = new Date();
        const t = (now - this.t) / 1000;
        this.t = now;

        this.#frames++;
        if (this.t >= this.#second) {
            this.#fps = this.#frames;
            this.#frames = 0;
            this.#second = new Date(this.#second.valueOf() + 1000);
        }

        this.#info.textContent = [
            `${this.#fps} FPS`,
            `${Vec.abs(this.ship.velocity).toFixed(1)} m/s`,
            `${Math.abs(this.ship.spin * 180 / Math.PI).toFixed(1)} deg/s`,
            // `${this.#abg}`,
            `${this.#control.x.toFixed(2)}, ${this.#control.y.toFixed(2)}`
        ].join("\n");

        // TODO windows & stars
        // TODO collision
        // TODO (velocity and rot vector)

        // Docking:
        // * A Impulse based dynamics
        //   * (we already use impulse based collision / contact - is like: establish constraint,
        //      execute it, now its solved so delete it instantly again)
        //   * Impulse based constraints
        //     https://box2d.org/publications/
        // * B alternative: spring mass dynamics
        // * C special case: two linked bodies, rotate move together (could not find a formula,
        //   seems a bit like double pendulum, could probably set up equation for translation and
        //   rotations and energy conservation and solve it, but yeah, no ;) - also this is very
        //   alike to what the constraint solvers do genarically, so I'd rather use this with
        //   existing explanations then deriving my own special solution)
        // => A > B > C
        // * D merge linked objects, treat like single body with new mass
        //   (and optional new center of mass)
        // A + D: Shift of CoM is tricky for cruise control, decel will introduce rotation
        //        might be cool or akward, would have to try :)

        // Pilot seat tolerance ~ d = 1m, amax = 15 G
        // F * d = m * v ** 2 / 2
        // a = v ** 2 / (2 * d)
        // v = sqrt(2 * a * d)
        // vmax ~= 17 m/s

        if (!this.paused) {
            this.#simulateEngines(t);
            this.#simulateConstraints(t);
            for (let entity of this.#entities) {
                // Apply rotational velocity
                const rot = entity.rot + entity.spin * t;
                // Apply linear velocity
                const pos = Vec.add(entity.pos, Vec.mul(entity.velocity, t));
                entity.update(pos, rot);
            }
            this.#computeCollisions(t);
        }

        // camera
        //const rot = entity.rot - this.ship.rot;
        // const camPos = new Vector();
        // const pos = entity.pos; // entity.pos.sub(this.ship.pos);
        const camRot = this.#options.rotateCam ? this.ship.rot : 0;
        // const camRot = this.#options.rotateCam ? 0 : 0;
        // const minDist = 4 * 8;
        //const minDist = 4 * 8 + 8;
        //const view = v * v / (2 * UI.ENGINE) + minDist;
        // const view = Math.max(v * v / (2 * UI.ENGINE), minDist);
        // const s = 1 / view; // * 2
        // const s = 1 / (2 * view); // (16 * 8); // instead of 2x we could move camera back
        // const s = 1 / (2 * minDist); // (16 * 8); // instead of 2x we could move camera back
        //const maxDist = (UI.TARGET_VELOCITY * UI.TARGET_VELOCITY) / (2 * UI.ENGINE) + 3 * 8; // 1.5 ship length
        // console.log("viewbox", maxDist);
        //const s = 1 / maxDist; // length of ship
        // const dir = new DOMPoint(-Math.sin(this.ship.rot), Math.cos(this.ship.rot));
        // const camPos = Vector.add(this.ship.pos, Vector.mul(dir, Math.max(view - minDist, 0)));
        // const camPos = Vector.add(this.ship.pos, Vector.mul(dir, view / 2));

        const v = Vector.abs(this.ship.velocity);
        const view = v * v / (2 * UI.ENGINE);
        const camPos = Vector.add(this.ship.pos, v === 0 ? new DOMPoint() : Vector.mul(this.ship.velocity, view / 2 / v));
        // const camPos = this.ship.pos;

        // v = a t
        //const maxBreak = UI.TARGET_VELOCITY * UI.TARGET_VELOCITY / (2 * UI.ENGINE);
        //console.log("time to reach / dist to break max v", UI.TARGET_VELOCITY / UI.ENGINE, maxBreak, maxBreak / 8 + 3);
        // console.log("BREMSWEG", view, "m");
        // console.log("Scale", s);
        // global cam
        this.querySelector("fleet-ui > svg > g").style.transform =
            // `scale(${s}, -${s}) rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px)`;
            `scaleY(-1) rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px)`;

        for (let entity of this.#entities) {
            // const pos = entity.pos.sub(this.ship.pos);
            entity.node.style.transform =
                // global cam
                `translate(${entity.pos.x}px, ${entity.pos.y}px) rotate(${entity.rot}rad)`;
                // individual cam
                // `rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px) translate(${entity.pos.x}px, ${entity.pos.y}px) rotate(${entity.rot}rad)`;
        }

        // debug

        if (this.#options.debug) {
            // individual cam
            // this.#annotationLayer.style.transform =
            //     `rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px)`;

            for (let entity of this.#entities) {
                if (!entity.annotation) {
                    entity.annotation = document.createElementNS(SVG_NS, "g");
                    entity.annotation.classList.add("annotation");
                    const v = document.createElementNS(SVG_NS, "line");
                    const omega = document.createElementNS(SVG_NS, "line");
                    const hitboxPath = document.createElementNS(SVG_NS, "path");
                    hitboxPath.classList.add("hitbox");
                    entity.annotation.append(v, omega, hitboxPath);
                    //this.canvas.append(entity.annotation);
                    this.#annotationLayer.append(entity.annotation);
                }

                const v = entity.annotation.children[0];
                const dir = new DOMPoint(-Math.sin(entity.rot), Math.cos(entity.rot));
                v.setAttribute("x1", entity.pos.x);
                v.setAttribute("y1", entity.pos.y);
                v.setAttribute("x2", entity.pos.x + entity.velocity.x);
                v.setAttribute("y2", entity.pos.y + entity.velocity.y);
                const omega = entity.annotation.children[1];
                // const dir = entity.v.x || entity.v.y ? Vec.norm(entity.v) : new DOMPoint(0, 1);
                const vRot = Vec.mul(Vec.getNormal(dir), 8 * entity.spin); // tangential speed in 8m radius
                //const vRot = entity.v.x || entity.v.y ? Vec.mul(Vec.getNormal(entity.v), entity.vRot) : new DOMPoint();
                omega.setAttribute("x1", entity.pos.x);
                omega.setAttribute("y1", entity.pos.y);
                omega.setAttribute("x2", entity.pos.x + vRot.x);
                omega.setAttribute("y2", entity.pos.y + vRot.y);
                /*omega.setAttribute("cx", entity.pos.x);
                omega.setAttribute("cy", entity.pos.y);
                omega.setAttribute(
                    "d",
                    `M ${entity.pos.x + 10} ${entity.pos.y} A 10 10 0 ${Math.abs(entity.vRot) > Math.PI ? 1 : 0} 0 ${entity.pos.x + 10 * Math.cos(entity.vRot)} ${entity.pos.y + 10 * Math.sin(entity.vRot)}`
                );*/
                entity.annotation.children[2].setAttribute("d", [
                    `M ${entity.hitbox.vertices[0].x}, ${entity.hitbox.vertices[0].y}`,
                    ...entity.hitbox.vertices.slice(1).map(p => `L ${p.x} ${p.y}`), "Z"
                ].join(" "));
                //entity.annotation.style.transform =
                //    `rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px)`;
            }
        } else {
            for (let entity of this.#entities) {
                if (entity.annotation) {
                    //entity.annotation.remove();
                    entity.annotation = null;
                }
            }
            this.#annotationLayer.textContent = "";
        }

        /*this.ship.pos = [this.ship.pos[0] + this.ship.v[0] * t,
                         this.ship.pos[1] + this.ship.v[1] * t];*/
        requestAnimationFrame(() => this.step());
    }

    #simulateEngines(t) {
        // Ship
        // const ENGINE_ROT = UI.ENGINE / 8; // 8 = radius of ship
        const ENGINE_ROT = 9.80665 * 5 / 8; // 8 = radius of ship

        const TARGET_SPIN = Math.PI; // rad / s

        const dir = new DOMPoint(-Math.sin(this.ship.rot), Math.cos(this.ship.rot));
        const ndir = Vector.getNormal(dir);

        let a;
        let aRot;
        if (this.#options.cruise) { //&& !this.ship.joint) {
            /*vt = v + a * tt;
            vt - v = a * tt;
            tt = (vt - v) / a;
            tt = Math.min(t, tt);
            vadd = a * tt;
            =>
            vadd = Math.min(vt - v, ENGINE * t);

            vt - v = a * t;
            a = vt - v / t;
            a = Math.min(a, ENGINE);
            vadd = a * t;
            =>
            vadd = Math.min(vt - v, ENGINE * t);*/

            /*st = s + ar * t;
            ar = (st - s) / t;*/

            // cannot (de)acel while spinning, bc spinning around non-COM needs vel
            // TODO rename to drosselung
            const spare = 1 - Math.abs(this.#control.x);

            const vf = Vector.dot(this.ship.velocity, dir);
            const vc = Vector.dot(this.ship.velocity, ndir);
            //const af = Math.max(Math.min((this.#control.y * TARGET_VELOCITY - vf) / t, ENGINE), -ENGINE);
            //const ac = Math.max(Math.min((0 - vc) / t, ENGINE), -ENGINE);
            const af = Math.max(Math.min((this.#control.y * UI.TARGET_VELOCITY - vf) / t, UI.ENGINE), -UI.ENGINE) * spare;
            const ac = Math.max(Math.min((0 - vc) / t, UI.ENGINE), -UI.ENGINE) * spare;
            a = Vec.add(Vec.mul(dir, af), Vec.mul(ndir, ac));
            // cannot (de)acel while spinning, bc spinning around non-COM needs vel
            //if (Math.abs(this.#control.x) > 0.5) { // || Math.abs(this.ship.spin) > 0.1) {
            //    a = new DOMPoint();
            //}
            /*if (this.#control.y === 0) {
            a = new DOMPoint();
            }*/

            aRot = Math.max(Math.min((this.#control.x * TARGET_SPIN - this.ship.spin) / t, ENGINE_ROT), -ENGINE_ROT);

            const EPSILON = 0.1;
            this.#thrusters[0].style.opacity = af < -EPSILON ? 1 : 0;
            this.#thrusters[1].style.opacity = af < -EPSILON ? 1 : 0;
            this.#thrusters[2].style.opacity = ac < -EPSILON || aRot < 0 ? 1 : 0;
            this.#thrusters[3].style.opacity = ac < -EPSILON || aRot > 0 ? 1 : 0;
            this.#thrusters[4].style.opacity = af > EPSILON ? 1 : 0;
            this.#thrusters[5].style.opacity = af > EPSILON ? 1 : 0;
            this.#thrusters[6].style.opacity = ac > EPSILON || aRot < 0 ? 1 : 0;
            this.#thrusters[7].style.opacity = ac > EPSILON || aRot > 0 ? 1 : 0;

            // console.log(aRot);
        } else {
            a = Vec.mul(dir, this.#control.y * UI.ENGINE);
            aRot = this.#control.x * ENGINE_ROT;
        }

        // Apply linear accelaration
        // F/A18E: (2 * 98kN) / 21t ~ 9.3
        // F35:        190kN  / 22t ~ 8.3
        // const ENGINE = 9; // m / s2
        // https://en.wikipedia.org/wiki/G-force (let's say max 5 G)
        this.ship.velocity = Vec.add(this.ship.velocity, Vec.mul(a, t));

        // Apply rotational accelaration
        // const ENGINE_ROT = Math.PI / 8; // 1 / s2
        // const ENGINE_ROT = Math.PI / 4; // 1 / s2
        // const ENGINE_ROT = Math.PI; // 1 / s2
        // const ENGINE_ROT = Math.PI / 2; // 1 / s2
        if (!this.norot) {
            this.ship.spin = this.ship.spin + aRot * t;
        }
    }

    #simulateConstraints(t) {
        for (let joint of this.#joints) {
            // linear:
            // (va + j n / ma) . n = (vb - j n / mb) . n
            // va . n + j n / ma . n = vb . n - j n / mb . n
            // va . n + j / ma = vb . n - j / mb

            // (va + j n / ma + (wa + rxa . j n / Ia) rxa) . n = (vb - j n / mb + (wb - j n . rxb / Ib) rxb) . n
            // va . n + j n / ma . n + (wa + j n . rxa / Ia) rxa . n
            // va . n + j n / ma . n + wa rxa . n + j n . rxa / Ia rxa . n
            // va . n + j / ma + wa rxa . n + j n . rxa / Ia rxa . n = ...
            // j / ma + rxa . j n / Ia rxa . n = va . n + wa rxa . n ...
            // j n / ma . n + rxa . j n / Ia rxa . n = va . n + wa rxa . n ...

            // va + j n / ma + (wa + j n . rxa / Ia) rxa = vb - j n / mb + (wb - j n . rxb / Ib) rxb
            // va + j n / ma + wa rxa + j n . rxa rxa / Ia = vb - j n / mb + wb rxb - j n . rxb rxb / Ib
            // j n / ma + j n / mb + j n . rxa rxa / Ia + j n . rxb rxb / Ib = vb - va + wb rxb - wa rxa
            // j (n / ma + n / mb + n . rxa rxa / Ia + n . rxb rxb / Ib) = vb - va + wb rxb - wa rxa

            // j n (1 / ma + 1 / mb + 1 . rxa rxa / Ia + 1 . rxb rxb / Ib) = vb - va + wb rxb - wa rxa
            // j n = (vb + wb rxb - va - wa rxa) / (1 / ma + 1 / mb + 1 . rxa rxa / Ia + 1 . rxb rxb / Ib)

            // va + j / ma = vb - j / mb
            // j (1 / ma + 1 / mb) = vb - va
            // j = (vb - va) / (1 / ma + 1 / mb)

            // pa + (va + j / ma) * t = pb + (vb + j / mb) * t
            // (pa + va * t) - (pb + vb * t) = j / mb * t - j / ma * t
            // ... = j t (1 / mb - 1 / ma)
            // =>
            // j = ((vb - va) + (pb - pa) / t) / (1 / ma + 1 / mb)

            const anchorA = joint.entityA.matrix.transformPoint(joint.anchorA);
            const anchorB = joint.entityB.matrix.transformPoint(joint.anchorB);

            // lin const vr = Vector.sub(joint.entityB.velocity, joint.entityA.velocity);
            const vr = Vector.sub(
                joint.entityB.getVelocityAt(anchorB), joint.entityA.getVelocityAt(anchorA)
            );
            const vd = Vector.mul(Vector.sub(anchorB, anchorA), 1 / t);
            const vv = Vector.add(vr, vd);
            const v = Vector.abs(vv);
            const n = v !== 0 ? Vector.mul(vv, 1 / v) : new DOMPoint(0, 1);

            const respondToCollision = (a, b, pa, pb, normal, velocity) => {
                // const v = Vector.abs(velocity);
                const v = Vector.dot(velocity, normal);
                const ra = Vector.getNormal(Vector.sub(pa, a.pos));
                const rb = Vector.getNormal(Vector.sub(pb, b.pos));
                const tc = Vector.dot(Vector.mul(ra, Vector.dot(ra, normal) / a.inertia), normal);
                const td = Vector.dot(Vector.mul(rb, Vector.dot(rb, normal) / b.inertia), normal);
                const e = 0;
                let jlin = v / (1 / a.mass + 1 / b.mass);
                let j = (e + 1) * v / ((1 / a.mass) + (1 / b.mass) + tc + td);
                const ja = Vector.mul(normal, j);
                const jb = Vector.mul(normal, -j);
                const dva = Vec.mul(ja, 1 / a.mass);
                const dvb = Vec.mul(jb, 1 / b.mass);
                const dsa = Vector.dot(ra, ja) / a.inertia;
                const dsb = Vector.dot(rb, jb) / b.inertia;
                a.velocity = Vec.add(a.velocity, dva);
                b.velocity = Vec.add(b.velocity, dvb);
                a.spin += dsa;
                b.spin += dsb;
                // j = Vector.mul(normal, j);
                //const dva = joint.entityA.applyImpulse(j);
                //const dvb = joint.entityB.applyImpulse(Vector.mul(j, -1));
                if (this.#frames === 0) {
                //console.log(a.spin, dsa);
                console.log(
                    "VREL PRE AFT", v, Vector.dot(
                        Vector.sub(b.getVelocityAt(pb), a.getVelocityAt(pa)),
                    normal), Vector.dot(vd, normal)
                );
                }
                return [dva, dvb];
            }

            const [dva, dvb] = respondToCollision(
                joint.entityA, joint.entityB, anchorA, anchorB, n, vv
            );

            // const n = drifting ? Vector.norm(v) : new DOMPoint(0, 1);
            // const drifting = v.x !== 0 || v.y !== 0;
            //console.log(v.x, v.y);

            //const dva = new DOMPoint(0, 0);
            //const dvb = new DOMPoint(0, 0);

            // const dva = Vector.mul(n, j / a.mass);
            // const dvb = Vector.mul(n, -j / b.mass);
            // joint.entityA.velocity = Vector.add(
            // console.log("JOINT", j * t);

            if (this.#options.debug) {
                let annotation = this.#annotations.get(joint);
                if (annotation) {
                    annotation.remove();
                }


                annotation = SVG.make("g", {class: "joint"}); // {class: `joint ${drifting ? "drifting" : ""}`});
                const dvaStop = Vector.add(anchorA, dva);
                const dvbStop = Vector.add(anchorB, dvb);
                // console.log(anchorA, dva, dvaStop);
                annotation.append(
                    SVG.make("circle", {cx: anchorA.x, cy: anchorA.y, r: 0.5}),
                    SVG.make("line", {x1: anchorA.x, y1: anchorA.y, x2: dvaStop.x, y2: dvaStop.y}),
                    SVG.make("circle", {cx: anchorB.x, cy: anchorB.y, r: 0.5}),
                    SVG.make("line", {x1: anchorB.x, y1: anchorB.y, x2: dvbStop.x, y2: dvbStop.y})
                );

                this.#annotationLayer.append(annotation);
                this.#annotations.set(joint, annotation);
            }
        }
    }

    #computeCollisions(t) {
        for (let i = 0; i < this.#entities.length; i++) {
            const a = this.#entities[i];

            for (let b of this.#entities.slice(i + 1)) {
                if (a.mass === Infinity && b.mass === Infinity) {
                    continue;
                }

                const collision = a.collides(b);
                /*if (collision) {
                    console.log("CD", collision.distance);
                }*/
                // if (!collision || collision.distance > -0.00001) {
                if (!collision) {
                    continue;
                }

                // Does not work, even if we split, because next frame it will rotate in a second
                // time.............
                // XXX should happen only once and only for entity with lower mass
                // XXX should we rather do this via collision distance?
                // undo movement / rotation
                // a.update(Vec.sub(a.pos, Vec.mul(a.velocity, t)), a.rot - a.spin * t);
                // console.log("STILL Collides", a.collides(b));
                // const entity = a.mass < b.mass ? a : b;
                // entity.pos = Vec.add(entity.pos, Vec.mul(collision.normal, -collision.distance));

                // https://en.wikipedia.org/wiki/Collision_response
                const normal = a === collision.b ? Vec.mul(collision.normal, -1) : collision.normal;

                // linear only
                // const v = Vec.dot(Vec.sub(b.velocity, a.velocity), normal);

                const ra = Vector.getNormal(Vector.sub(collision.vertex, a.pos));
                const rb = Vector.getNormal(Vector.sub(collision.vertex, b.pos));

                function getRelV(a, b, ra, rb) {
                    // console.log(a.velocity, Vector.mul(ra, a.spin), b.velocity, Vector.mul(rb, b.spin));
                    return Vector.sub(
                        Vector.add(b.velocity, Vector.mul(rb, b.spin)),
                        Vector.add(a.velocity, Vector.mul(ra, a.spin))
                    );
                }
                const v = Vector.dot(getRelV(a, b, ra, rb), normal);

                // collision detected, but objects move away from each other - can only happen if a
                // previous collision was missed due to warping or via rotation
                if (v >= 0) {
                    continue;
                }

                /*if (a === this.ship) {
                    let skip = false;
                    for (let joint of this.#joints) {
                        if (
                            (joint.entityA === a && joint.entityB === b) ||
                            (joint.entityA === b && joint.entityB === a)
                        ) {
                            skip = true;
                            break;
                        }
                    }
                    if (skip) {
                        // console.log("SKIP", this.#frames);
                        // XXX
                        // XXX
                        // const rot = this.ship.rot - this.ship.spin * t;
                        // const pos = Vector.sub(this.ship.pos, Vector.mul(this.ship.velocity, t));
                        // this.ship.update(pos, rot);
                        // this.ship.update(this.ship.pos, rot);
                        // this.ship.spin = 0;

                        // KLEB
                        //this.norot = true;
                        //this.ship.spin = 0;

                        // IMPULSE
                        this.ship.spin = -this.ship.spin;
                        continue;
                    }
                }*/

                let stickyedge = false;
                if (a === this.ship) {
                    if (
                        (
                            collision.edge[0] === a.hitbox.vertices[3] &&
                            collision.edge[1] === a.hitbox.vertices[0]
                        ) || collision.vertex === a.hitbox.vertices[3] ||
                        collision.vertex === a.hitbox.vertices[0]
                    ) {
                        stickyedge = true;
                    }
                }

                let p = collision.vertex;
                const DELTA = 1;
                if (a.mass <= b.mass) {
                    // a.update(Vec.add(a.pos, Vector.mul(normal, collision.distance)), a.rot);
                    a.update(Vec.add(a.pos, Vector.mul(normal, collision.distance - DELTA)), a.rot);
                    p = Vec.add(p, Vector.mul(normal, collision.distance - DELTA / 2));
                } else {
                    b.update(Vec.sub(b.pos, Vector.mul(normal, collision.distance - DELTA)), b.rot);
                    p = Vec.sub(p, Vector.mul(normal, collision.distance - DELTA / 2));
                }

                // TEST
                // XXX
                /*if (a === this.ship && this.ship.joint && (this.ship.joint.entityB === b || stickyedge)) {
                    if (this.#options.debug) {
                        this.#annotations.get(this.ship.joint).remove();
                    }
                    this.#joints.delete(this.ship.joint);
                    this.ship.joint = null;
                }*/
                if (a === this.ship && stickyedge && (!this.ship.joint || this.ship.joint?.entityB === b)) {
                    console.log("NEW JOINT", collision.distance);
                    const joint = new Joint(
                        //this.ship, new DOMPoint(0, 8), container, new DOMPoint(0, -1.25)
                        //collision.a, collision.a.matrix.inverse().transformPoint(collision.vertex),
                        //collision.b, collision.b.matrix.inverse().transformPoint(collision.vertex)
                        a, a.matrix.inverse().transformPoint(p),
                        b, b.matrix.inverse().transformPoint(p)
                    );
                    this.ship.joint = joint;
                    this.#joints.add(joint);
                    continue;
                }

                const e = 0.5;
                // linear
                // let j = (e + 1) * v / ((1 / a.mass) + (1 / b.mass));
                const vlin = Vec.dot(Vec.sub(b.velocity, a.velocity), normal);
                const jlin = (e + 1) * vlin / ((1 / a.mass) + (1 / b.mass));
                const tc = Vector.dot(Vector.mul(ra, Vector.dot(ra, normal) / a.inertia), normal);
                const td = Vector.dot(Vector.mul(rb, Vector.dot(rb, normal) / b.inertia), normal);
                let j = (e + 1) * v / ((1 / a.mass) + (1 / b.mass) + tc + td);
                /*const ja = Vector.mul(normal, jlin);
                const jb = Vector.mul(normal, -jlin);*/
                const ja = Vector.mul(normal, j);
                const jb = Vector.mul(normal, -j);

                /*const dva = a.applyImpulse(j);
                const dvb = b.applyImpulse(Vector.mul(j, -1));*/
                /*const dva = Vec.mul(normal, j / a.mass);
                const dvb = Vec.mul(normal, -j / b.mass);*/

                const dva = Vec.mul(ja, 1 / a.mass);
                const dvb = Vec.mul(jb, 1 / b.mass);
                const dsa = Vector.dot(ra, ja) / a.inertia;
                const dsb = Vector.dot(rb, jb) / b.inertia;
                a.velocity = Vec.add(a.velocity, dva);
                b.velocity = Vec.add(b.velocity, dvb);
                a.spin += dsa;
                b.spin += dsb;

                const dvsa = Vector.mul(ra, dsa);
                const dvsb = Vector.mul(rb, dsb);

                // console.log("VREL PRE AFT", vlin, Vec.dot(Vec.sub(b.velocity, a.velocity), normal));
                // console.log("VREL PRE AFT", v, Vector.dot(getRelV(a, b, ra, rb), normal));

                // console.log("COLLISION", Vec.abs(dva), Vec.abs(dvb), Math.max(Vec.abs(dva), Vec.abs(dvb)) > 17 ? "DEAD" : "OK");
                /*if (a === this.ship) {
                    // a.spin = -a.spin; // HACK
                    // a.rot -= a.spin * t;
                }*/

                if (this.#options.debug) {
                    //console.log("COLLISION", collision);
                    let g = this.#annotationLayer.querySelector(".collision");
                    if (g) {
                        g.remove();
                    }
                    g = document.createElementNS(SVG_NS, "g");
                    g.classList.add("collision");
                    const line = document.createElementNS(SVG_NS, "line");
                    line.setAttribute("x1", collision.edge[0].x);
                    line.setAttribute("y1", collision.edge[0].y);
                    line.setAttribute("x2", collision.edge[1].x);
                    line.setAttribute("y2", collision.edge[1].y);
                    g.append(line);
                    const circle = document.createElementNS(SVG_NS, "circle");
                    circle.setAttribute("cx", collision.vertex.x);
                    circle.setAttribute("cy", collision.vertex.y);
                    circle.setAttribute("r", 0.5);
                    g.append(circle);
                    g.append(
                        SVG.makeLine(collision.vertex, Vec.add(collision.vertex, dva)),
                        SVG.makeLine(collision.vertex, Vec.add(collision.vertex, dvb)),
                        SVG.makeLine(collision.vertex, Vec.add(collision.vertex, dvsa)),
                        SVG.makeLine(collision.vertex, Vec.add(collision.vertex, dvsb)),
                    );
                    this.#annotationLayer.append(g);
                }
            }
        }
    }
}
customElements.define("fleet-ui", UI);

class Entity {
    pos = new DOMPoint();
    rot = 0;
    velocity = new DOMPoint();
    spin = 0;

    mass;
    inertia;
    shape;
    hitbox;
    matrix;

    node;
    annotation;

    constructor(node, shape, mass) {
        this.node = node;
        this.shape = shape;
        this.mass = mass;
        let r = Math.max(
            Vector.abs(Vector.sub(shape.vertices[1], shape.vertices[0])),
            Vector.abs(Vector.sub(shape.vertices[2], shape.vertices[1]))
        ) / 2;
        this.inertia = this.mass * r * r / 2;
        //this.#updateHitbox();
        this.update(new DOMPoint(), 0);
    }

    update(position, rotation) {
        this.pos = position;
        this.rot = rotation;
        this.matrix = new DOMMatrix().translateSelf(this.pos.x, this.pos.y)
            .rotateSelf(this.rot * 180 / Math.PI);
        this.hitbox = this.shape.transform(this.matrix);
    }

    /*get pos() {
        return this.#pos;
    }

    set pos(value) {
        this.#pos = value;
        // camera
        //const pos = this.#pos.sub(this.node.parentElement.parentElement.ship.pos);
        //this.node.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${this.rot}rad)`;
        // this.node.style.transform = `translate(${this.#pos.x}px, ${this.#pos.y}px) rotate(135deg)`;
        // this.node.style.transform = `translate(${this._pos[0]}px, ${this._pos[1]}px) rotate(135deg)`;
        //this.node.style.transform = `rotate(135deg)`;
        //this.node.style.left = `${this._pos[0]}px`;
        //this.node.style.top = `${this._pos[1]}px`;
    }*/

    getVelocityAt(p) {
        return Vector.add(
            this.velocity, Vector.mul(Vector.getNormal(Vector.sub(p, this.pos)), this.spin)
        );
    }

    applyImpulse(j, p) {
        const dv = Vector.mul(j, 1 / this.mass);
        this.velocity = Vector.add(this.velocity, dv);
        return dv;
    }

    collides(other) {
        // https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
        // Separating axis theorem

        const collision = {
            a: null,
            b: null,
            edge: null,
            vertex: null,
            normal: null,
            distance: -Infinity
        };

        for (let [a, b] of [[this, other], [other, this]]) {
            for (let e of a.hitbox.edges) {
                const axis = Vec.norm(Vec.getNormal(Vec.sub(e[1], e[0])));
                const bound = Vec.dot(e[0], axis);

                let minV = null;
                let minDistance = Infinity;
                for (let v of b.hitbox.vertices) {
                    const distance = Vec.dot(v, axis) - bound;
                    if (distance < minDistance) {
                        minV = v;
                        minDistance = distance;
                    }
                }

                if (minDistance >= 0) {
                    return null;
                }
                if (minDistance > collision.distance) {
                    collision.a = a;
                    collision.b = b;
                    collision.edge = e;
                    collision.vertex = minV;
                    collision.normal = axis;
                    collision.distance = minDistance;
                }
            }
        }

        return collision;
    }
}

class Joint {
    entityA;
    anchorA;
    entityB;
    anchorB;

    constructor(entityA, anchorA, entityB, anchorB) {
        this.entityA = entityA;
        this.anchorA = anchorA;
        this.entityB = entityB;
        this.anchorB = anchorB;
    }
};
