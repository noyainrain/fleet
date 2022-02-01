addEventListener("error", event => {
    const e = event.error;
    document.body.textContent = `${e.constructor?.name}: ${e.message}\n${e.stack}`;
    document.body.style.whiteSpace = "pre";
});

import "./fleet/simulation.js";
import {POI} from "./fleet/core.js";
import {Mission} from "./fleet/missions.js";
import {Cargo, Character, Dock, DockingEvent, FleetGenerator, Ship} from "./fleet/game.js";
import {Box, Polygon, Vector, animate, animate2, createSVGElement, transition} from "./fleet/util.js?fh";
import {SHIP_NAMES, SURNAMES} from "./fleet/names.js?barx";
import {Body, CollisionEvent, Joint} from "./fleet/simulation.js";

const ROLES = ["captain", "navigator", "engineer", "doctor", "guard", "logistician", "scientist"];
//Communicator
//Cook
//Crewmember -- support for the last mission

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

const Vec = Vector;

/** Player-Controlled space shuttle. */
class Shuttle extends EventTarget {
    body;
    #message = null;
    /** @type {SVGSVGElement} */
    #navigation;
    #missionPOI = null;
    #fleetPOI = null;
    /** @type {?POI} */
    #cargoPOI = null;
    /** @type {Map<POI, Element>} */
    #pois = new Map();
    /** @type {?number} */
    #alarm = null;

    /**
     * @param {Body} body
     * @param {UI} game
     */
    constructor(body, game) {
        super();
        this.body = body;
        this.game = game;
        /** @type {Set<Joint>} */
        this.joints = new Set();
        /** @type {?Cargo} */
        this.cargo = null;

        const svg = this.game.querySelector(".navigation");
        if (!(svg instanceof SVGSVGElement)) {
            throw new Error();
        }
        this.#navigation = svg;

        this.body.addEventListener(
            "collide",
            event => {
                if (
                    this.body === event.bodyA && event.edge[0] === this.body.shape.vertices[5] ||
                    this.body === event.bodyB && (
                        event.vertex === this.body.shape.vertices[5] ||
                        event.vertex === this.body.shape.vertices[0]
                    ) && this.joints.size < 2
                ) {
                    this.#attach(
                        this.body === event.bodyA ? event.bodyB : event.bodyA, event.point
                    );
                }
            }
        );
    }

    /** Alarm time in s. */
    get alarm() {
        return this.#alarm;
    }

    set alarm(value) {
        this.#alarm = value;
        this.game.classList.toggle("shuttle-alarm-set", this.#alarm !== null);
    }

    // DELETE
    //async dock(cargo = null) {
    //    if (cargo && this.cargo) {
    //        throw new Error("full TODO");
    //    }
    //    if (!cargo && !this.cargo) {
    //        throw new Error("empty TODO");
    //    }

    //    const bar = this.game.querySelector(".docking rect");
    //    this.game.classList.add("shuttle-docking");
    //    await new Promise(resolve => setTimeout(resolve, 0));
    //    bar.style.width = "100%";
    //    await new Promise(resolve => bar.addEventListener("transitionend", resolve, {once: true}));
    //    bar.style.width = "0%";
    //    this.game.classList.remove("shuttle-docking");

    //    if (cargo) {
    //        // this.#cargoPOI = new POI(cargo.dock.parts[0], `${cargo.load.name} drop off`);
    //        this.#cargoPOI = new POI(cargo.dock.parts[0], "Drop off");
    //        this.addPOI(this.#cargoPOI);
    //        if (cargo.pickUpMessage) {
    //            // post - op
    //            this.message(cargo.pickUpMessage.from, cargo.pickUpMessage.text);
    //        }
    //    } else {
    //        this.removePOI(this.#cargoPOI);
    //        this.#cargoPOI = null;
    //        if (this.cargo.dropOffMessage) {
    //            // post - op
    //            this.message(this.cargo.dropOffMessage.from, this.cargo.dropOffMessage.text);
    //        }
    //    }

    //    this.cargo = cargo;
    //    this.game.querySelector(".shuttle-cargo").textContent = cargo ? cargo.name : "No cargo";

    //    //if (cargo?.pickUpMessage) {
    //    //    await this.message(cargo.pickUpMessage.from, cargo.pickUpMessage.text);
    //    //} else if (this.cargo?.dropOffMessage) {
    //    //    await this.message(this.cargo.dropOffMessage.from, this.cargo.dropOffMessage.text);
    //    //}

    //    //const p = this.game.querySelector(".cargo");
    //    //if (cargo) {
    //    //    //const type = `${this.cargo.destination.type[0].toUpperCase()}${this.cargo.destination.type.slice(1)}`;
    //    //    //p.textContent =
    //    //    //    cargo.destination.type === "dock" ?
    //    //    //    //`Passenger\n${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}` :
    //    //    //    //`Passenger\n${type} on ${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}`;
    //    //    //    `Crewmember ${cargo.name}\n${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}` :
    //    //    //    `Crewmember ${cargo.name}\n${type} on ${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}`;
    //    //} else {
    //    //    //p.textContent = "";
    //    //    //this.message("Review", `${4 + Math.trunc(Math.random() * 2)} / 5 *`);
    //    //}
    //    //this.updateTarget();

    //    /*await new Promise(resolve => setTimeout(resolve, 0));
    //    this.game.classList.add("shuttle-undocking");
    //    bar.style.width = "100%";
    //    await new Promise(resolve => bar.addEventListener("transitionend", resolve, {once: true}));
    //    this.game.releaseShuttleLink();
    //    bar.style.width = "0%";
    //    this.game.classList.remove("shuttle-undocking");*/
    //}

    async message(from, text) {
        const lastThread = this.#message;
        this.#message = (async() => {
            await lastThread;
            const dialog = this.game.querySelector(".dialog");
            const fromSpan = this.game.querySelector(".message-from");
            const textSpan = this.game.querySelector(".message-text");
            fromSpan.textContent = from;
            textSpan.textContent = text;
            this.game.classList.add("shuttle-messaged");
            const words = `${from}: ${text}`.split(/\s+/u).length;
            await new Promise(resolve => setTimeout(resolve, words * 60 / 120 * 1000));
            await animate(dialog, "fade-out");
            this.game.classList.remove("shuttle-messaged");
        })();
        await this.#message;
    }

    async assignMission(mission) {
        this.mission = mission;
        mission.addEventListener("missionend", () => {
            this.mission = null;
            this.game.classList.remove("shuttle-assigned");
        });
        this.game.classList.toggle("shuttle-assigned", mission);
        this.standingBy = false;
        this.updateTarget();
    }

    async standBy() {
        if (this.standingBy || this.mission) {
            return;
        }

        this.standingBy = true;
        this.game.classList.add("shuttle-assigned");

        // await days + 7 animation

        // TODO time log curve

        this.game.level++;

        this.assignMission(new Mission(this.game.level, this.game));

        (async () => {
            const h1 = this.game.querySelector(".mission");
            h1.textContent = `Mission ${this.game.level}`;
            await animate(h1, "fade");
            h1.textContent = "";
        })();
        // h1.style.animationName = "fade";

        // set mission

        // dock.tick() if no mission create mini mission
        // dock.tick() load cargo of mission
        // hello message

        // dock.tick() unload cargo of mission
        // closing message
    }

    /**
     * Attach ...
     *
     * @param {Body} body - ...
     * @param {DOMPoint} point - ...
     */
    #attach(body, point) {
        const joint = new Joint(
            this.body, body, this.body.matrix.inverse().transformPoint(point),
            body.matrix.inverse().transformPoint(point),
            createSVGElement("circle", {r: 0.5, fill: "url(#spark-gradient)"})
        );
        this.game.join(joint);
        this.joints.add(joint);
        this.game.classList.add("shuttle-linked");

        const left = this.body.matrix.transformPoint(new DOMPoint(-1.5, -4));
        const right = this.body.matrix.transformPoint(new DOMPoint(1.5, -4));
        for (let ship of this.game.fleet) {
            for (let row of ship.modules) {
                for (let module of row) {
                    if (module instanceof Dock) {
                        // const dock = module;
                        // TODO adjust zone size
                        // TODO do not check if cargo here. just call dock.dock() and let it return
                        // an error if the cargo has the wrong destination. :)
                        if (
                            (!this.cargo || this.cargo.dock === module) &&
                            this.joints.size >= 2 &&
                            module.zone.contains(left) && module.zone.contains(right)
                            //[...this.joints].every(
                            //    joint => dock.zone.contains(
                            //        joint.bodyA.matrix.transformPoint(joint.anchorA)
                            //    )
                            //)
                        ) {
                            this.#dock(module);
                        }
                    }
                }
            }
        }
    }

    /** Detach all objects. */
    detach() {
        this.game.disjoin(...this.joints);
        this.joints.clear();
        this.game.classList.remove("shuttle-linked");
    }

    /** @param {Dock} dock */
    async #dock(dock) {
        const bar = /** @type {SVGRectElement} */ (this.game.querySelector(".docking rect"));
        this.game.classList.add("shuttle-docking");
        await new Promise(resolve => setTimeout(resolve, 0));
        bar.style.width = "100%";
        await new Promise(resolve => bar.addEventListener("transitionend", resolve, {once: true}));
        bar.style.width = "0%";
        this.game.classList.remove("shuttle-docking");

        if (this.cargo) {
            this.removePOI(this.#cargoPOI);
            this.#cargoPOI = null;
            if (this.cargo.dropOffMessage) {
                // post - op
                this.message(this.cargo.dropOffMessage.from, this.cargo.dropOffMessage.text);
            }
        }
        const outgoing = this.cargo;
        const incoming = dock.dock(outgoing);
        this.cargo = incoming;
        if (this.cargo) {
            // this.#cargoPOI = new POI(cargo.dock.parts[0], `${cargo.load.name} drop off`);
            this.#cargoPOI = new POI(this.cargo.dock.parts[0], this.cargo.label ?? "Drop off");
            this.addPOI(this.#cargoPOI);
            if (this.cargo.pickUpMessage) {
                // post - op
                this.message(this.cargo.pickUpMessage.from, this.cargo.pickUpMessage.text);
            }
        }
        const div = /** @type {HTMLDivElement} */ (this.game.querySelector(".shuttle-cargo"));
        div.textContent = this.cargo ? this.cargo.load.name : "No cargo";

        this.dispatchEvent(new DockingEvent("dock", {dock, incoming, outgoing}));
    }

    updateTarget() {
        //let target = "No target\n ";
        //if (this.mission) {
        //    target = this.mission.target;
        //    const type = `${target.module.type[0].toUpperCase()}${target.module.type.slice(1)}`;
        //    target = target.module.type === "dock" ?
        //        //`Passenger\n${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}` :
        //        //`Passenger\n${type} on ${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}`;
        //        `${type} ${target.dock.id} on ${target.module.ship.name}` :
        //        `${type} on ${target.module.ship.name}, dock ${target.dock.id}`;
        //    //const time = (new Date() - this.mission.t) / 1000;
        //    //target += `\n${time.toFixed(1)} s`;
        //    const time = (new Date() - this.mission.t) / 1000;
        //    target += this.mission.time ? `\n${this.mission.time.toFixed(1)} s` : "\n ";
        //}
        //p.textContent = target;

        //if (this.#missionPOI !== (this.mission?.poi ?? null)) {
        //    console.log("MP UPDATE");
        //    if (this.#missionPOI) {
        //        console.log("REMOVING OLD MP")
        //        this.removePOI(this.#missionPOI);
        //        this.#missionPOI = null;
        //    }
        //    if (this.mission) {
        //        console.log("ADDING NEW MP");
        //        this.#missionPOI = this.mission.poi;
        //        this.addPOI(this.#missionPOI);
        //    }
        //}
    }

    /**
     * Display one or more points of interest.
     * @param {POI[]} pois - POIs to add.
     */
    addPOI(...pois) {
        for (let poi of pois) {
            if (!this.#pois.has(poi)) {
                const node = createSVGElement("g");
                const text = createSVGElement("text", {y: 32});
                text.textContent = poi.label;
                node.append(
                    createSVGElement("path", {class: "poi", d: "M 0 0 L -8 16 L 8 16 Z"}), text
                );
                this.#pois.set(poi, node);
                this.#navigation.append(node);
            }
        }
    }

    /**
     * Remove one or more points of interest.
     * @param {POI[]} pois - POIs to remove.
     */
    removePOI(...pois) {
        for (let poi of pois) {
            const node = this.#pois.get(poi);
            if (node) {
                node.remove();
                this.#pois.delete(poi);
            }
        }
    }

    tick(t) {
        const p = /** @type {HTMLParagraphElement} */ (this.game.querySelector(".hud-alarm p"));
        if (this.alarm && this.alarm - this.game.world.now <= 0) {
            this.alarm = null;
        }
        p.textContent = this.alarm ? `${(this.alarm - this.game.world.now).toFixed(1)} s` : "-";

        const bounds = document.documentElement.getBoundingClientRect()
        const center = new DOMPoint(bounds.width / 2, bounds.height / 2);
        const r = Math.min(bounds.width, bounds.height) / 2 - 2 * 8;
        let smatrix = this.game.canvas.getScreenCTM();
        let matrix = new DOMMatrix([smatrix.a, smatrix.b, smatrix.c, smatrix.d, smatrix.e, smatrix.f]);
        for (let [poi, node] of this.#pois.entries()) {
            // console.log("POI", poi, poi.body, poi.body.position);
            let p = poi.body instanceof DOMPoint ? poi.body : poi.body.position;
            p = matrix.transformPoint(p);
            const v = Vector.sub(p, center);
            //console.log(this.game.querySelector(".canvas").createSVGPoint().matrixTransform(smatrix));
            //console.log(p);
            const dist = Vector.abs(v);
            const dir = Vector.norm(v);
            const angle = Math.atan2(dir.y, dir.x) + Math.PI / 2;
            // console.log("DISTR", dist, r, dist > r);
            if (dist > r) {
                p = Vector.add(center, Vector.mul(dir, r));
            }
            node.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${angle}rad)`;
        }

        const fleetBounds = Box.grow(this.game.fleetBounds, 75 / 2);
        if (!this.#fleetPOI && !Box.contains(fleetBounds, this.body.position)) {
            this.#fleetPOI = new POI(new DOMPoint(0, 0), "Fleet");
            this.addPOI(this.#fleetPOI);
        }
        if (this.#fleetPOI && Box.contains(fleetBounds, this.body.position)) {
            this.removePOI(this.#fleetPOI);
            this.#fleetPOI = null;
        }
    }
}

/*class Cargo {
    name;
    destination;
    dock;

    constructor(name, destination, dock) {
        this.name = name;
        this.destination = destination;
        this.dock = dock;
    }
}*/

export class UI extends HTMLElement {
    ship;
    #shuttleNode;
    #thrusters;

    t;
    #keys = new Set();
    #control = new DOMPoint();

    #entities = [];
    #annotations = new Map();

    #options = {rotateCam: true, debug: false, cruise: true};
    #info;
    #stars;

    #annotationLayer;
    #entityLayer;

    #abg = "- nothing";
    #calibration = null;
    paused = true;
    #generator;
    #zoom = false;

    level = 0;

    //static ENGINE = 9.80665 * 5; // m / s2
    //static TARGET_VELOCITY = 150; // m / s ; reached in 3s
    //static ENGINE = 9.80665 * 5; // m / s2
    //static TARGET_VELOCITY = 100; // m / s ; reached in 2s
    //static ENGINE = 9.80665 * 1.67; // m / s2
    //static TARGET_VELOCITY = 50; // m / s ; reached in 3s

    //static ENGINE = 9.80665 * 5; // m / s2; reached in 1s
    static ENGINE = 9.80665 * 2.5; // m / s2; reached in 2s
    static TARGET_VELOCITY = 50; // m / s

    constructor() {
        super();

        /**
         * TODO.
         * @type {Set<Joint>}
         */
        this.joints = new Set();
        /** @type {Ship[]} */
        this.fleet = [];
        /** @type {Character[]} */
        this.characters = [];
        /**
         * Space shuttle.
         * @type {Shuttle}
         */
        this.shuttle;
        this.#generator = new FleetGenerator();

        /** @type {import("./fleet/simulation.js").WorldElement} */
        this.world;

        document.addEventListener("keydown", event => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s", "Shift", "Enter"].includes(event.key)) {
                if (this.paused) {
                    this.play();
                }
            }

            switch (event.key) {
            case "c":
                this.#options.rotateCam = !this.#options.rotateCam;
                break;
            case "0":
                this.#options.debug = !this.#options.debug;
                break;
            case "9":
                this.#options.cruise = !this.#options.cruise;
                break;
            case "m":
                this.#zoom = !this.#zoom;
                break;
            case "p":
                if (this.paused) {
                    this.play();
                } else {
                    this.pause();
                }
                break;
            case "Shift":
                this.shuttle.detach();
                break;
            case "Enter":
                this.shuttle.standBy();
                break;
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
                if (this.#keys.has("ArrowLeft") || this.#keys.has("a")) {
                    x = 1;
                } else if (this.#keys.has("ArrowRight") || this.#keys.has("d")) {
                    x = -1;
                } else {
                    x = 0;
                }
                if (this.#keys.has("ArrowUp") || this.#keys.has("w")) {
                    y = 1;
                } else if (this.#keys.has("ArrowDown") || this.#keys.has("s")) {
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
            this.#generateStars();
        }
        checkOrientation();
        addEventListener("resize", checkOrientation);
    }

    get debug() {
        return this.#options.debug;
    }

    play() {
        this.classList.remove("paused");
        this.classList.remove("opening");
        this.classList.remove("game-over");
        this.#calibration = null;
        this.paused = false;
        console.log("PLAYING");
    }

    pause() {
        this.classList.add("paused");
        this.paused = true;
        console.log("PAUSED");
    }

    getRandomLocation() {
        const modules = this.fleet.map(ship => ship.modules).flat(2);
        return modules[Math.trunc(Math.random() * modules.length)];
    }

    connectedCallback() {
        setTimeout(() => {
            this.querySelector(".play").addEventListener("click", async () => {
                await document.body.requestFullscreen();
            });
            this.querySelector(".back").addEventListener("click", async () => {
                await document.body.requestFullscreen();
            });

            this.querySelector(".standby").addEventListener("click", event => {
                this.shuttle.standBy();
                event.stopPropagation();
            });

            this.querySelector(".map").addEventListener("click", event => {
                this.#zoom = !this.#zoom;
                event.stopPropagation();
            });

            this.querySelector(".release").addEventListener("click", event => {
                this.shuttle.detach();
                event.stopPropagation();
            });

            this.querySelector(".credits a").addEventListener("click", event => {
                event.stopPropagation();
            });

            this.addEventListener("click", () => {
                if (this.paused) {
                    this.play();
                } else {
                    this.pause();
                }
            });

            this.canvas = this.querySelector(".canvas g");
            this.#entityLayer = this.canvas.querySelector(".entities");
            this.#annotationLayer = this.querySelector(".annotations");
            this.#shuttleNode = this.querySelector(".shuttle");
            this.#thrusters = this.#shuttleNode.querySelectorAll(".thruster");
            //this.#entities[0].position = new Vector(100, 200);
            this.#info = this.querySelector(".info .content");
            this.world = /** @type {import("./fleet/simulation.js").WorldElement} */ (this.querySelector("fleet-world"));

            this.#init();
            this.world.addEventListener("tick", event => this.step(event.detail.t));
            //requestAnimationFrame(() => this.step());

            //this.play();

            /*
            // colortest
            this.canvas.append(
                createSVGElement("rect", {x: "-60", y: "-20", width: "110", height: "60", fill: "#fff"}),
                createSVGElement("rect", {x: "-20", y: "-20", width: "110", height: "60", fill: "#808080"}),
                createSVGElement("rect", {x: "20", y: "-20", width: "110", height: "60", fill: "#000"})
            );
            for (let i = 0; i < 16; i++) {
                for (let x = 0; x < 11; x++) {
                    const text = createSVGElement("text", {x: -59 + x * 10, y: 19 - i * 3});
                    // ccc 80%, 666 40%
                    text.style.fill = `hsl(${360 / 16 * i}, 50%, 50%)`;
                    // text.style.fill = `hsl(${360 / 16 * i}, ${x * 10}%, 50%)`;
                    // text.style.fill = `hsl(${360 / 16 * i}, 60%, ${x * 10}%)`;
                    text.style.fontSize = "3px";
                    text.textContent = "AQUA";
                    this.canvas.append(text);
                }
            }*/
        }, 0);
    }

    step(t) {
        //this.#stars.firstElementChild.style.transform = `rotate(${new Date().valueOf() / 10000}rad)`;
        //requestAnimationFrame(() => this.step());
        //return;

        // basic 4 point nav route to compute therotical limit :)
        // (overestimates 2 directly next to each other, but rest is cool)

        this.#info.textContent = [
            `${this.world.frameRate} FPS`,
            `${Vec.abs(this.ship.velocity).toFixed()} m/s`,
            `${Math.abs(this.ship.spin * 180 / Math.PI).toFixed()} °/s`,
            // `${this.#abg}`,
            `${(this.#control.x * 100).toFixed()} %`,
            `${(this.#control.y * 100).toFixed()} %`
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

            // XXX copied
            for (let entity of this.#entities) {
                // Apply rotational velocity
                const rot = entity.orientation + entity.spin * t;
                // Apply linear velocity
                const pos = Vec.add(entity.position, Vec.mul(entity.velocity, t));
                entity.update(pos, rot);
            }

            for (let joint of this.joints) {
                joint.update();
            }
            this.#computeCollisions(t);
        }

        let camRot;
        let camPos;
        let camScale;
        if (this.#zoom) {
            // console.log(this.fleet[0].parts);
            const x = this.fleet.map(
                ship => ship.parts.map(part => part.hitbox.vertices.map(v => v.x))
            ).flat(2);
            const y = this.fleet.map(
                ship => ship.parts.map(part => part.hitbox.vertices.map(v => v.y))
            ).flat(2);
            const min = new DOMPoint(Math.min(...x), Math.min(...y));
            const max = new DOMPoint(Math.max(...x), Math.max(...y));
            const width = max.x - min.x;
            const height = max.y - min.y;
            camPos = new DOMPoint(min.x + width / 2, min.y + height / 2);
            camRot = 0;
            camScale = 75 / Math.max(width + 4 * 8, height + 4 * 8);
            // return new DOMRect(min.x, min.y, max.x - min.x, max.y - min.y);
        } else {

        // XXX
        //this.ship.orientation += Math.PI / 100;

        // camera
        //const rot = entity.orientation - this.ship.orientation;
        // const camPos = new Vector();
        // const pos = entity.position; // entity.position.sub(this.ship.position);
        camRot = this.#options.rotateCam ? this.ship.orientation : 0;
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
        // const dir = new DOMPoint(-Math.sin(this.ship.orientation), Math.cos(this.ship.orientation));
        // const camPos = Vector.add(this.ship.position, Vector.mul(dir, Math.max(view - minDist, 0)));
        // const camPos = Vector.add(this.ship.position, Vector.mul(dir, view / 2));

        const v = Vector.abs(this.ship.velocity);
        const view = v * v / (2 * UI.ENGINE);
        camPos = Vector.add(this.ship.position, v === 0 ? new DOMPoint() : Vector.mul(this.ship.velocity, view / 2 / v));
        // const camPos = this.ship.position;
        camScale = 1;
        }

        // v = a t
        //const maxBreak = UI.TARGET_VELOCITY * UI.TARGET_VELOCITY / (2 * UI.ENGINE);
        //console.log("time to reach / dist to break max v", UI.TARGET_VELOCITY / UI.ENGINE, maxBreak, maxBreak / 8 + 3);
        // console.log("BREMSWEG", view, "m");
        // console.log("Scale", s);
        // global cam
        this.canvas.style.transform =
            `scale(${camScale}, -${camScale}) rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px)`;
            // `scale(${s}, -${s}) rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px)`;
            // `scale(0.25) scaleY(-1) rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px)`;
        // this.#stars.firstElementChild.style.transform = `translate(50%, 50%) rotate(${camRot}rad) translate(-900px, -900px)`;
        // this.#stars.style.transform = `rotate(${camRot}rad)`;
        // this.#stars.firstElementChild.style.transform = `rotate(${camRot}rad)`;
        // this.#stars.style.transform = `rotate(${camRot}rad)`;
        //this.#stars.style.transform = `rotate(${new Date().valueOf() / 10000}rad)`;
        this.querySelector(".starsopt").style.transform = `translate(-50%, -50%) rotate(${camRot}rad)`;
        // this.querySelector("canvas").style.transform = `translate(-50%, -50%) rotate(${camRot}rad)`;

        // XXX COPIED
        for (let entity of this.#entities) {
            // const pos = entity.position.sub(this.ship.position);
            entity.node.style.transform =
                // global cam
                `translate(${entity.position.x}px, ${entity.position.y}px) rotate(${entity.orientation}rad)`;
                // individual cam
                // `rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px) translate(${entity.position.x}px, ${entity.position.y}px) rotate(${entity.orientation}rad)`;
        }

        for (let joint of this.joints) {
            if (joint.element) {
                joint.element.style.transform = `translate(${joint.position.x}px, ${joint.position.y}px)`;
            }
        }

        // debug

        if (this.#options.debug) {
            // individual cam
            // this.#annotationLayer.style.transform =
            //     `rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px)`;

            for (let entity of this.#entities) {
                if (!entity.annotation) {
                    entity.annotation = createSVGElement("g", {class: "annotation"});
                    const v = createSVGElement("line");
                    const omega = createSVGElement("line");
                    const hitboxPath = createSVGElement("path");
                    hitboxPath.classList.add("hitbox");
                    entity.annotation.append(v, omega, hitboxPath);
                    //this.canvas.append(entity.annotation);
                    this.#annotationLayer.append(entity.annotation);
                }

                const v = entity.annotation.children[0];
                const dir = new DOMPoint(-Math.sin(entity.orientation), Math.cos(entity.orientation));
                v.setAttribute("x1", entity.position.x);
                v.setAttribute("y1", entity.position.y);
                v.setAttribute("x2", entity.position.x + entity.velocity.x);
                v.setAttribute("y2", entity.position.y + entity.velocity.y);
                const omega = entity.annotation.children[1];
                // const dir = entity.v.x || entity.v.y ? Vec.norm(entity.v) : new DOMPoint(0, 1);
                const vRot = Vec.mul(Vec.getNormal(dir), 8 * entity.spin); // tangential speed in 8m radius
                //const vRot = entity.v.x || entity.v.y ? Vec.mul(Vec.getNormal(entity.v), entity.vRot) : new DOMPoint();
                omega.setAttribute("x1", entity.position.x);
                omega.setAttribute("y1", entity.position.y);
                omega.setAttribute("x2", entity.position.x + vRot.x);
                omega.setAttribute("y2", entity.position.y + vRot.y);
                /*omega.setAttribute("cx", entity.position.x);
                omega.setAttribute("cy", entity.position.y);
                omega.setAttribute(
                    "d",
                    `M ${entity.position.x + 10} ${entity.position.y} A 10 10 0 ${Math.abs(entity.vRot) > Math.PI ? 1 : 0} 0 ${entity.position.x + 10 * Math.cos(entity.vRot)} ${entity.position.y + 10 * Math.sin(entity.vRot)}`
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

        /*this.ship.position = [this.ship.position[0] + this.ship.v[0] * t,
                         this.ship.position[1] + this.ship.v[1] * t];*/

        if (!this.paused) {
            for (let ship of this.fleet) {
                ship.tick(this);
            }
            if (this.shuttle.mission) {
                this.shuttle.mission.tick(t, this);
            }
            this.shuttle.tick(t);
        }

        //requestAnimationFrame(() => this.step());
    }

    #simulateEngines(t) {
        // Ship
        // const ENGINE_ROT = UI.ENGINE / 8; // 8 = radius of ship
        // const ENGINE_ROT = 9.80665 * 5 / 8; // 8 = radius of ship

        // a) use full engine to come to target spin as soon as possible:
        //    90 deg / s would be good to comfortably navigate a corner
        //    BUT: 1s throttle will be added on top of 2s decel :/
        //    -> 180d/s target = 0.5s throttle
        //       BUT also 0.5s turn which makes everything more sensitive
        // =>
        // b) use lower accel to get first 90d turn in 1s (after that spin will be 180d)
        //    i.e. 45d accel, 45d deaccel = 0.5s throttle
        // const TARGET_SPIN = Math.PI; // rad / s

        // theta = alpha * t * t / 2
        // alpha = 2 * theta / (t * t)
        // a = 2 * theta * r / (t * t); m / (s * s)
        // a = 2 * pi / 4 * 4 / (1 / 2 * 1 / 2)
        // a = 2 * pi * 4

        // spin = alpha * t;
        // spin = a * t / r;
        // a = spin * r / t; m / (s * s)
        // a = pi * 4
        // const ENGINE_ROT = this.ship.r * 4 * Math.PI; // 90 grad in 0.5s = 180 grad in 1s
        // const ENGINE_ROT = this.ship.r * Math.PI; // 22.5 grad in 0.5s = 45 grad in 1s
        const ENGINE_ROT = this.ship.r * 2 * Math.PI; // 45 grad in 0.5s = 90 grad in 1s
        const TARGET_SPIN = Math.PI; // rad / s
        //const ENGINE_ROT = UI.ENGINE;
        //const TARGET_SPIN = Math.PI; // rad / s
        // console.log(ENGINE_ROT, UI.ENGINE, ENGINE_ROT < UI.ENGINE, ENGINE_ROT / this.ship.r / Math.PI, "PI");

        const dir = new DOMPoint(-Math.sin(this.ship.orientation), Math.cos(this.ship.orientation));
        const ndir = Vector.getNormal(dir);

        let thrustY = this.#control.y;
        let thrustX = 0;
        let thrustSpin = this.#control.x;
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

            //const spare = 1 - Math.abs(this.#control.x);
            //const af = Math.max(Math.min((this.#control.y * UI.TARGET_VELOCITY - vf) / t, UI.ENGINE), -UI.ENGINE) * spare;
            //const ac = Math.max(Math.min((0 - vc) / t, UI.ENGINE), -UI.ENGINE) * spare;
            //aRot = Math.max(Math.min((this.#control.x * TARGET_SPIN - this.ship.spin) / t, ENGINE_ROT), -ENGINE_ROT);

            // cannot (de)acel while spinning, bc spinning around non-COM needs vel
            //if (Math.abs(this.#control.x) > 0.5) { // || Math.abs(this.ship.spin) > 0.1) {
            //    a = new DOMPoint();
            //}
            /*if (this.#control.y === 0) {
            a = new DOMPoint();
            }*/

            //const s = Math.max((this.#control.y * UI.TARGET_VELOCITY - vf) / t / UI.ENGINE, throttle);
            //const n = Math.max((vf - this.#control.y * UI.TARGET_VELOCITY) / t / UI.ENGINE, throttle);

            const vf = Vector.dot(this.ship.velocity, dir);
            const vc = Vector.dot(this.ship.velocity, ndir);
            // cannot (de)acel while spinning, bc spinning around non-COM needs vel
            const throttle = 1 - Math.abs(this.#control.x);
            thrustY = Math.max(
                Math.min((this.#control.y * UI.TARGET_VELOCITY - vf) / t / UI.ENGINE, throttle),
                -throttle
            );
            thrustX = Math.max(Math.min((0 - vc) / t / UI.ENGINE, throttle), -throttle);
            thrustSpin = Math.max(
                Math.min(
                    (this.#control.x * TARGET_SPIN - this.ship.spin) * this.ship.r / t / UI.ENGINE,
                    ENGINE_ROT / UI.ENGINE
                ),
                -ENGINE_ROT / UI.ENGINE
            );
            if (thrustSpin) {
            // console.log(thrustSpin);
            }

            // console.log(aRot);
        }

        const a = Vec.add(Vec.mul(dir, thrustY * UI.ENGINE), Vec.mul(ndir, thrustX * UI.ENGINE));
        // const alpha = thrustSpin * ENGINE_ROT / this.ship.r;
        const alpha = thrustSpin * UI.ENGINE / this.ship.r;
        //a = Vec.mul(dir, this.#control.y * UI.ENGINE);
        //aRot = this.#control.x * ENGINE_ROT;

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
            this.ship.spin = this.ship.spin + alpha * t;
        }

        // values are capped between 0 and 1
        // thrustx + thrustspin may use more than thruster capacity 1
        this.#thrusters[0].style.opacity = -thrustY;
        this.#thrusters[1].style.opacity = -thrustY;
        this.#thrusters[2].style.opacity = Math.max(-thrustX, 0) + Math.max(-thrustSpin, 0);
        this.#thrusters[3].style.opacity = Math.max(-thrustX, 0) + Math.max(thrustSpin, 0);
        this.#thrusters[4].style.opacity = thrustY;
        this.#thrusters[5].style.opacity = thrustY;
        this.#thrusters[6].style.opacity = Math.max(thrustX, 0) + Math.max(-thrustSpin, 0);
        this.#thrusters[7].style.opacity = Math.max(thrustX, 0) + Math.max(thrustSpin, 0);

        /*const EPSILON = 0.1;
        this.#thrusters[0].style.opacity = af < -EPSILON ? 1 : 0;
        this.#thrusters[1].style.opacity = af < -EPSILON ? 1 : 0;
        this.#thrusters[2].style.opacity = ac < -EPSILON || aRot < 0 ? 1 : 0;
        this.#thrusters[3].style.opacity = ac < -EPSILON || aRot > 0 ? 1 : 0;
        this.#thrusters[4].style.opacity = af > EPSILON ? 1 : 0;
        this.#thrusters[5].style.opacity = af > EPSILON ? 1 : 0;
        this.#thrusters[6].style.opacity = ac > EPSILON || aRot < 0 ? 1 : 0;
        this.#thrusters[7].style.opacity = ac > EPSILON || aRot > 0 ? 1 : 0;*/
    }

    #simulateConstraints(t) {
        for (let joint of this.joints) {
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

            const anchorA = joint.bodyA.matrix.transformPoint(joint.anchorA);
            const anchorB = joint.bodyB.matrix.transformPoint(joint.anchorB);

            // lin const vr = Vector.sub(joint.bodyB.velocity, joint.bodyA.velocity);
            const vr = Vector.sub(
                joint.bodyB.getVelocityAt(anchorB), joint.bodyA.getVelocityAt(anchorA)
            );
            const vd = Vector.mul(Vector.sub(anchorB, anchorA), 1 / t);
            const vv = Vector.add(vr, vd);
            const v = Vector.abs(vv);
            const n = v !== 0 ? Vector.mul(vv, 1 / v) : new DOMPoint(0, 1);

            const respondToCollision = (a, b, pa, pb, normal, velocity) => {
                // const v = Vector.abs(velocity);
                const v = Vector.dot(velocity, normal);
                const ra = Vector.getNormal(Vector.sub(pa, a.position));
                const rb = Vector.getNormal(Vector.sub(pb, b.position));
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
                //const dva = joint.bodyA.applyImpulse(j);
                //const dvb = joint.bodyB.applyImpulse(Vector.mul(j, -1));
                //if (this.#frames === 0) {
                //console.log(a.spin, dsa);
                //console.log(
                //    "VREL PRE AFT", v, Vector.dot(
                //        Vector.sub(b.getVelocityAt(pb), a.getVelocityAt(pa)),
                //    normal), Vector.dot(vd, normal)
                //);
                //}
                return [dva, dvb];
            }

            const [dva, dvb] = respondToCollision(
                joint.bodyA, joint.bodyB, anchorA, anchorB, n, vv
            );

            // const n = drifting ? Vector.norm(v) : new DOMPoint(0, 1);
            // const drifting = v.x !== 0 || v.y !== 0;
            //console.log(v.x, v.y);

            //const dva = new DOMPoint(0, 0);
            //const dvb = new DOMPoint(0, 0);

            // const dva = Vector.mul(n, j / a.mass);
            // const dvb = Vector.mul(n, -j / b.mass);
            // joint.bodyA.velocity = Vector.add(
            // console.log("JOINT", j * t);

            if (this.#options.debug) {
                const annotation = createSVGElement("g", {class: "joint"}); // {class: `joint ${drifting ? "drifting" : ""}`});
                const dvaStop = Vector.add(anchorA, dva);
                const dvbStop = Vector.add(anchorB, dvb);
                // console.log(anchorA, dva, dvaStop);
                annotation.append(
                    createSVGElement("circle", {cx: anchorA.x, cy: anchorA.y, r: 0.5}),
                    createSVGElement("line", {x1: anchorA.x, y1: anchorA.y, x2: dvaStop.x, y2: dvaStop.y}),
                    createSVGElement("circle", {cx: anchorB.x, cy: anchorB.y, r: 0.5}),
                    createSVGElement("line", {x1: anchorB.x, y1: anchorB.y, x2: dvbStop.x, y2: dvbStop.y})
                );
                this.annotate(joint, annotation);
            }
        }
    }

    annotate(id, node) {
        let annotation = this.#annotations.get(id);
        if (annotation) {
            annotation.remove();
        }
        this.#annotationLayer.append(node);
        this.#annotations.set(id, node);
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
                // a.update(Vec.sub(a.position, Vec.mul(a.velocity, t)), a.orientation - a.spin * t);
                // console.log("STILL Collides", a.collides(b));
                // const entity = a.mass < b.mass ? a : b;
                // entity.position = Vec.add(entity.position, Vec.mul(collision.normal, -collision.distance));

                // https://en.wikipedia.org/wiki/Collision_response
                const normal = a === collision.b ? Vec.mul(collision.normal, -1) : collision.normal;

                // linear only
                // const v = Vec.dot(Vec.sub(b.velocity, a.velocity), normal);

                const ra = Vector.getNormal(Vector.sub(collision.vertex, a.position));
                const rb = Vector.getNormal(Vector.sub(collision.vertex, b.position));

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
                    for (let joint of this.joints) {
                        if (
                            (joint.bodyA === a && joint.bodyB === b) ||
                            (joint.bodyA === b && joint.bodyB === a)
                        ) {
                            skip = true;
                            break;
                        }
                    }
                    if (skip) {
                        // console.log("SKIP", this.#frames);
                        // XXX
                        // XXX
                        // const rot = this.ship.orientation - this.ship.spin * t;
                        // const pos = Vector.sub(this.ship.position, Vector.mul(this.ship.velocity, t));
                        // this.ship.update(pos, rot);
                        // this.ship.update(this.ship.position, rot);
                        // this.ship.spin = 0;

                        // KLEB
                        //this.norot = true;
                        //this.ship.spin = 0;

                        // IMPULSE
                        this.ship.spin = -this.ship.spin;
                        continue;
                    }
                }*/

                //let stickyedge = false;
                //if (a === this.ship) {
                //    if (
                //        (
                //            collision.edge[0] === a.hitbox.vertices[5] &&
                //            collision.edge[1] === a.hitbox.vertices[0]
                //        ) || collision.vertex === a.hitbox.vertices[5] ||
                //        collision.vertex === a.hitbox.vertices[0]
                //    ) {
                //        stickyedge = true;
                //    }
                //}

                const edge = collision.a.shape.getEdge(
                    collision.a.hitbox.vertices.indexOf(collision.edge[0])
                );
                const vertex = collision.b.shape.vertices[
                    collision.b.hitbox.vertices.indexOf(collision.vertex)
                ];
                console.log("EDGE VERTEX I", edge, vertex);

                let p = collision.vertex;
                const DELTA = 0.1;
                if (a.mass <= b.mass) {
                    // a.update(Vec.add(a.position, Vector.mul(normal, collision.distance)), a.orientation);
                    a.update(Vec.add(a.position, Vector.mul(normal, collision.distance - DELTA)), a.orientation);
                    p = Vec.add(p, Vector.mul(normal, collision.distance - DELTA / 2));
                } else {
                    b.update(Vec.sub(b.position, Vector.mul(normal, collision.distance - DELTA)), b.orientation);
                    p = Vec.sub(p, Vector.mul(normal, collision.distance - DELTA / 2));
                }

                // TEST
                // XXX
                /*if (a === this.ship && this.ship.joint && (this.ship.joint.bodyB === b || stickyedge)) {
                    if (this.#options.debug) {
                        this.#annotations.get(this.ship.joint).remove();
                    }
                    this.joints.delete(this.ship.joint);
                    this.ship.joint = null;
                }*/
                // if (a === this.ship && stickyedge && (!this.ship.joint || this.ship.joint?.bodyB === b)) {

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

                const event = new CollisionEvent(
                    "collide", {bodyA: collision.a, bodyB: collision.b, point: p, edge, vertex}
                );
                a.dispatchEvent(event);
                b.dispatchEvent(event);

                // console.log("VREL PRE AFT", vlin, Vec.dot(Vec.sub(b.velocity, a.velocity), normal));
                // console.log("VREL PRE AFT", v, Vector.dot(getRelV(a, b, ra, rb), normal));

                // console.log("COLLISION", Vec.abs(dva), Vec.abs(dvb), Math.max(Vec.abs(dva), Vec.abs(dvb)) > 17 ? "DEAD" : "OK");
                /*if (a === this.ship) {
                    // a.spin = -a.spin; // HACK
                    // a.orientation -= a.spin * t;
                }*/

                //if (
                //    a === this.shuttle.body && stickyedge &&
                //    (!this.shuttle.joints.size || this.shuttle.joints.values().next().value.bodyB === b)
                //) {
                //    console.log("NEW JOINT", collision.distance);
                //    const joint = new Joint(
                //        //this.ship, new DOMPoint(0, 8), container, new DOMPoint(0, -1.25)
                //        //collision.a, collision.a.matrix.inverse().transformPoint(collision.vertex),
                //        //collision.b, collision.b.matrix.inverse().transformPoint(collision.vertex)
                //        a, b, a.matrix.inverse().transformPoint(p),
                //        b.matrix.inverse().transformPoint(p),
                //        createSVGElement("circle", {r: 0.5, fill: "url(#spark-gradient)"})
                //    );
                //    this.shuttle.joints.add(joint);
                //    this.joints.add(joint);
                //    this.#entityLayer.append(joint.element);
                //    this.classList.add("shuttle-linked");
                //    continue;
                //}

                if (this.#options.debug) {
                    //console.log("COLLISION", collision);
                    let g = this.#annotationLayer.querySelector(".collision");
                    if (g) {
                        g.remove();
                    }
                    g = createSVGElement("g", {class: "collision"});
                    const line = createSVGElement("line", {
                        x1: collision.edge[0].x,
                        y1: collision.edge[0].y,
                        x2: collision.edge[1].x,
                        y2: collision.edge[1].y
                    });
                    const circle = createSVGElement(
                        "circle", {cx: collision.vertex.x, cy: collision.vertex.y, r: 0.5}
                    );
                    const [toDVA, toDVB, toDVSA, toDVSB] =
                        [dva, dvb, dvsa, dvsb].map(p => Vec.add(collision.vertex, p));
                    g.append(
                        line, circle,
                        createSVGElement("line", {x1: collision.vertex.x, y1: collision.vertex.y, x2: toDVA.x, y2: toDVA.y}),
                        createSVGElement("line", {x1: collision.vertex.x, y1: collision.vertex.y, x2: toDVB.x, y2: toDVB.y}),
                        createSVGElement("line", {x1: collision.vertex.x, y1: collision.vertex.y, x2: toDVSA.x, y2: toDVSA.y}),
                        createSVGElement("line", {x1: collision.vertex.x, y1: collision.vertex.y, x2: toDVSB.x, y2: toDVSB.y})
                        /*SVG.makeLine(collision.vertex, Vec.add(collision.vertex, dva)),
                        SVG.makeLine(collision.vertex, Vec.add(collision.vertex, dvb)),
                        SVG.makeLine(collision.vertex, Vec.add(collision.vertex, dvsa)),
                        SVG.makeLine(collision.vertex, Vec.add(collision.vertex, dvsb)),*/
                    );
                    this.#annotationLayer.append(g);
                }
            }
        }
    }

    init() {
        // XXX
        this.#init();
    }

    #init() {
        this.#entities = [];
        this.joints = new Set();
        this.#annotations = new Map();
        this.level = 0;

        this.#entityLayer.textContent = "";
        this.#annotationLayer.textContent = "";

        //this.#entities = Array.from(
        //    this.querySelectorAll(".object"),
        //    path => {
        //        // const bbox = path.getBBox();
        //        return new Body(
        //            // path, Polygon.fromRect(bbox.x, bbox.y, bbox.width, bbox.height), 10000
        //            new Polygon(
        //                // TODO fix hexagon better
        //                [new DOMPoint(-2, -4), new DOMPoint(-2, 0), new DOMPoint(-1, 4),
        //                 new DOMPoint(1, 4),
        //                 new DOMPoint(2, 0), new DOMPoint(2, -4)]),
        //            10000,
        //            path
        //        );
        //    }
        //);
        this.ship = new Body(
            new Polygon(
                // TODO fix hexagon better
                [new DOMPoint(-2, -4), new DOMPoint(-2, 0), new DOMPoint(-1, 4),
                 new DOMPoint(1, 4),
                 new DOMPoint(2, 0), new DOMPoint(2, -4)]),
            10000,
            this.#shuttleNode
        );
        this.shuttle = new Shuttle(this.ship, this);
        this.shuttle.updateTarget();
        this.#entities.push(this.ship);
        this.#entityLayer.append(this.#shuttleNode);


        this.fleet = this.#generator.generate();
        const parts = this.fleet.map(ship => ship.parts).flat()
        this.#entities.push(...parts)
        this.#entityLayer.append(...parts.map(part => part.node));

        const shipBounds = this.fleet.map(ship => ship.bounds).flat();
        const min = new DOMPoint(
            Math.min(...shipBounds.map(bounds => bounds.x)),
            Math.min(...shipBounds.map(bounds => bounds.y))
        );
        const max = new DOMPoint(
            Math.max(...shipBounds.map(bounds => bounds.x + bounds.width)),
            Math.max(...shipBounds.map(bounds => bounds.y + bounds.height))
        );
        this.fleetBounds = new DOMRect(min.x, min.y, max.x - min.x, max.y - min.y);

        const minY = Math.min(...this.fleet.map(ship => ship.bounds.y).flat());
        console.log("MIN Y", minY);
        this.shuttle.body.update(new DOMPoint(0, minY), 0);

        //this.#docks =
        //    this.fleet.map(ship => ship.modules).flat(2).filter(module => module instanceof Dock);
        //for (let ship of this.fleet) {
        //    for (let row of ship.modules) {
        //        for (let module of row) {
        //            for (let part of module.parts) {
        //                this.#entities.push(part)
        //                this.canvas.querySelector(".entities").append(part.node);
        //            }
        //        }
        //    }
        //}

        // const ship = this.fleet[0];
        // this.ship.update(Vector.add(ship.parts[ship.parts.length - 1].position, new DOMPoint(30, 0)), 0);

        //this.#createContainer(new DOMPoint(0, 50 + 8 + 2.5 / 2));
        //this.#createContainer(new DOMPoint(-10, 70 + 8 + 2.5 / 2));
        //this.#createContainer(new DOMPoint(10, 90 + 8 + 2.5 / 2));

        this.characters = ROLES.map(
            role => new Character(role, SURNAMES[Math.trunc(Math.random() * SURNAMES.length)])
        );
        this.characters.push(
            new Character("Communicator", SURNAMES[Math.trunc(Math.random() * SURNAMES.length)])
        );
    }

    #createContainer(position) {
        // https://en.wikipedia.org/wiki/Intermodal_container
        const width = 6; // 12
        const height = 2.5; // 16
        const rect = SVG.makeRect(
            new DOMPoint(-width / 2, -height / 2), width, height, {fill: "silver"}
        );
        const shape = Polygon.fromRect(-width / 2, -height / 2, width, height);
        const container = new Body(shape, 1000, rect); // 2.5 * 1000); // 1);
        container.update(position, 0);
        this.#entityLayer.append(rect);
        this.#entities.push(container);
        return container;
    }

    #generateStars() {
        console.log("GENERATING STARS");
        // this.#stars = this.querySelector(".stars");
        // const g = this.#stars.firstElementChild;
        // this.#stars.style.background = "black";
        this.#stars = document.createElement("svg");
        const g = createSVGElement("g");
        this.#stars.append(g);
        // const bounds = this.#stars.getBoundingClientRect(); // stars.getBBox();
        const bounds = document.documentElement.getBoundingClientRect(); // stars.getBBox();
        // const size = Math.max(bounds.width, bounds.height);
        const size = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height);
        // console.log("R", bounds.width, bounds.height, size / 2);
        // pi r2 = A
        // pi (x * r)2 = pi x2 r2 = x2 A
        // const count = (Math.PI * size * size / 4) / (Math.PI * (1920 * 1920 + 1080 * 1080) / 4) * 1000;

        // 256 stars per megapixel
        // const count = Math.trunc(Math.PI * Math.pow(size / 2, 2) / 1000000 * 256);
        // const count = 1024;
        const count = 512;

        // console.log("STARS", count);
        this.#stars.setAttribute("width", Math.trunc(size));
        this.#stars.setAttribute("height", Math.trunc(size));
        //const x = bounds.width / 2;
        //const y = bounds.height / 2;
        const x = size / 2;
        const y = size / 2;
        // g.append(createSVGElement("rect", {x: x - size / 2, y: y - size / 2, width: size, height: size, stroke: "red"}));
        for (let i = 0; i < count; i++) {
            const s = Math.random();
            const r = Math.sqrt(Math.random()) * size / 2;
            const phi = Math.random() * 2 * Math.PI;
            g.append(
                createSVGElement(
                    "circle",
                    {
                        //cx: Math.random() * bounds.width,
                        //cy: Math.random() * bounds.height,
                        //cx: Math.random() * size,
                        //cy: Math.random() * size,
                        //cx: x + (Math.random() - 0.5) * size,
                        //cy: y + (Math.random() - 0.5) * size,
                        cx: x + r * Math.cos(phi),
                        cy: y + r * Math.sin(phi),
                        r: Math.random() * 1,
                        // fill: `hsl(${226 + s * (372 - 226)}, 100%, ${80 + s * 20}%)`
                        // fill: `hsl(${226 + s * (372 - 226)}, 100%, 100%)`
                        fill: `hsl(${226 + s * (372 - 226)}, 100%, ${80 + s * 20}%)`,
                        // fill: "white"
                    }
                )
            );
        }
        // TODO transforming this needs some FPS... try to render to image for more performance
        // (convert SVG DOM to svg string, img.src = data:// ...)
        // const data = '<svg width="10" height="10"><rect width="10" height="10" fill="red"></rect></svg>';
        // const data = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"></rect></svg>';
        const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${this.#stars.innerHTML}</svg>`;
        this.querySelector(".starsopt").src = `data:image/svg+xml,${encodeURIComponent(data)}`;
        this.#stars.remove();
        this.querySelector(".starsopt").addEventListener("load", () => {
            // const pic = this.querySelector("canvas");
            const pic = document.createElement("canvas");
            pic.width = size;
            pic.height = size;
            const ctx = pic.getContext("2d");
            ctx.drawImage(this.querySelector(".starsopt"), 0, 0);
            // this.querySelector(".starsopt").remove();
            this.querySelector(".starsopt").src = pic.toDataURL("image/png");
            // pic.remove();
        }, {once: true});
        //console.log(this.#stars.outerHTML);
            // #ff3300 -> 12
            // #a1b7ff -> 226
            // 50 - 80%
    }

    /**
     * Add one or more joints between bodies.
     *
     * @param {Joint[]} joints - Joints to add.
     */
    join(...joints) {
        for (let joint of joints) {
            this.joints.add(joint);
            if (joint.element) {
                this.#entityLayer.append(joint.element);
            }
        }
    }

    /**
     * Remove one or more joints between bodies.
     *
     * @param {Joint[]} joints - Joints to remove.
     */
    disjoin(...joints) {
        for (let joint of joints) {
            this.joints.delete(joint);
            if (joint.element) {
                joint.element.remove();
            }
            // TODO
            if (this.#options.debug) {
                this.#annotations.get(joint).remove();
            }
        }
    }
}
customElements.define("fleet-ui", UI);
