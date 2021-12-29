addEventListener("error", event => {
    const e = event.error;
    document.body.textContent = `${e.constructor?.name}: ${e.message}\n${e.stack}`;
    document.body.style.whiteSpace = "pre";
});

const SVG_NS = "http://www.w3.org/2000/svg";

import {Box, animate, animate2, transition} from "./fleet/util.js?fh";
import {Entity, Polygon, Vector} from "./fleet/core.js?lxol";
import {SHIP_NAMES, SURNAMES} from "./fleet/names.js?barx";

const ROLES = {
    Captain: "An emergency meeting has been called at {loc}.",
    Navigator: "There is an urgent meeting at {loc}.",
    Engineer: "We have a technical problem at {loc}.",
    Doctor: "We have a medical emergency at {loc}.",
    Guard: "An offense has been reported at {loc}.",
    Logistician: "We have some problematic cargo at {loc}.",
    Scientist: "Something went wrong with the experiment running at {loc}."
};
//Communicator
//Cook
//Crewmember -- support for the last mission

const CONCLUSIONS = {
    Captain: "Then there was a mutiny.",
    Navigator: "Then there was a navigation mishap.",
    Engineer: "Then the computers crashed.",
    Doctor: "Then there was a tragic accident.",
    Guard: "Then a traitor took control.",
    Logistician: "Then there was some toxic cargo.",
    Scientist: "Then there was an outbreak."
};

const POIS = {
    Captain: "Emergency meeting",
    Navigator: "Urgent meeting",
    Engineer: "Technical problem",
    Doctor: "Medical emergency",
    Guard: "Offense",
    Logistician: "Problematic cargo",
    Scientist: "Bad experiment"
}

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

class Ship {
    static MODULE_WIDTH = 40;
    static MODULE_HEIGHT = 20;
    static BLEED = 0.1;
    static UNIT = 4;

    name;
    color;
    modules = [];
    // parts;
    // docks;

    constructor(name, color) {
        this.name = name;
        this.color = color;
        // XXX
        // this.parts = this.modules.flat(2);
    }

    get parts() {
        return this.modules.map(row => row.map(module => module.parts)).flat(2);
    }

    get bounds() {
        const vertices = this.parts.map(part => part.hitbox.vertices).flat();
        const xs = vertices.map(p => p.x);
        const ys = vertices.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return new DOMRect(minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY);
    }

    tick(game) {
        for (let row of this.modules) {
            for (let module of row) {
                if (module instanceof Dock) {
                    module.tick(game);
                }
            }
        }

    }
}

class Module {
    type;
    parts;
    ship;

    constructor(type, parts, ship) {
        this.type = type;
        this.parts = parts;
        this.ship = ship;
    }

    get name() {
        return `the ${this.type} on the ${this.ship.name}`;
    }

    findNearestDock() {
        function getModuleCoords(module) {
            const ship = module.ship;
            for (let y = 0; y < ship.modules.length; y++) {
                for (let x = 0; x < ship.modules[y].length; x++) {
                    if (module === ship.modules[y][x]) {
                        return [x, y];
                    }
                }
            }
            return undefined;
        }

        const module = this;
        const ship = this.ship;
        const coords = getModuleCoords(module);
        const queue = [coords];
        const visited = new Set();
        while (queue.length) {
            const [x, y] = queue.shift();
            if (
                !(x >= 0 && x < ship.modules[0].length && y >= 0 && y < ship.modules.length) ||
                visited.has([x, y].toString())
            ) {
                continue;
            }
            visited.add([x, y].toString());
            const module = ship.modules[y][x];
            if (module.type === "dock") {
                return module;
            }
            queue.push(
                [x - 1, y - 1], [x, y - 1], [x + 1, y - 1], [x - 1, y], [x + 1, y],
                [x - 1, y + 1], [x, y + 1], [x + 1, y + 1]
            );
        }
        throw new Error();
    }
}

class Dock extends Module {
    id;
    state;
    #hot;

    constructor(parts, ship, id, hot) {
        super("dock", parts, ship);
        this.id = id;
        this.state = "arrival";
        this.#hot = hot;
    }

    get name() {
        return `dock ${this.id} on the ${this.ship.name}`;
    }

    tick(game) {
        switch (this.state) {
        case "arrival":
            // TODO not every frame
            const hot = this.#hot.transform(this.parts[0].matrix);
            if (
                // (!game.shuttle.cargo || game.shuttle.cargo.dock === this) &&
                (!game.shuttle.mission || game.shuttle.mission.target.dock === this) &&
                game.shuttle.links.size >= 2 &&
                [...game.shuttle.links].every(
                    link => hot.contains(link.entityA.matrix.transformPoint(link.anchorA))
                )
            ) {
                let mission;
                // if (game.shuttle.cargo?.dock === this) {
                //if (game.shuttle.mission.target.dock === this) {

                let cargo;
                if (game.shuttle.mission) {
                    cargo = game.shuttle.mission.target.id === "pickup" ?
                        game.shuttle.mission.character : null;
                } else {
                    cargo = new Character(
                        "Crewmember", SURNAMES[Math.trunc(Math.random() * SURNAMES.length)]
                    );
                }

                //game.querySelector(".cargo").textContent =
                //    cargo.destination.type === "dock" ?
                //    `Passenger to ${cargo.ship.name}, dock ${cargo.dock.id}` :
                //    `Passenger to ${cargo.destination.type} on ${cargo.ship.name}, dock ${cargo.dock.id}`;

                this.state = "docking";
                (async () => {
                    await game.shuttle.dock(cargo);

                    if (!game.shuttle.mission) {
                        // const ship = game.fleet[Math.trunc(Math.random() * game.fleet.length)];
                        //const x = Math.trunc(Math.random() * ship.modules[0].length);
                        //const y = Math.trunc(Math.random() * ship.modules.length);
                        // const modules = ship.modules.flat();
                        // const modules = game.fleet.map(ship => ship.modules).flat(2);
                        let module = null;
                        let dock = this;
                        while (dock === this) {
                            console.log("FIND DOCK");
                            // module = modules[Math.trunc(Math.random() * modules.length)];
                            module = game.getRandomLocation();
                            dock = module.findNearestDock();
                        }

                        await game.shuttle.message(
                            cargo.name,
                             // `Hi! To the ${cargo.destination.type} on the ${cargo.destination.ship.name}, please!`
                             `Hi! To ${module.name}, please!`
                        );

                        //const name = SURNAMES[Math.trunc(Math.random() * SURNAMES.length)];
                        //cargo = new Cargo(name, module, dock);
                        mission = new Mission(cargo, null, null, module, dock);
                        game.shuttle.assignMission(mission);
                    }

                    this.state = "departure";
                })();
            }
            break;

        case "docking":
            break;

        case "departure":
            if (game.shuttle.links.size === 0) {
                this.state = "arrival";
            }
            break;

        default:
            throw new Error();
        }
    }
}

class Shuttle {
    body;
    game;
    links = new Set();
    cargo = null;
    #message = null;
    #navigation;
    pois = new Map();
    #missionPOI = null;
    #fleetPOI = null;

    constructor(body, game) {
        this.body = body;
        this.game = game;
        this.#navigation = this.game.querySelector(".navigation");
    }

    async dock(cargo = null) {
        const bar = this.game.querySelector(".docking rect");
        this.game.classList.add("shuttle-docking");
        await new Promise(resolve => setTimeout(resolve, 0));
        bar.style.width = "100%";
        await new Promise(resolve => bar.addEventListener("transitionend", resolve, {once: true}));
        bar.style.width = "0%";
        this.game.classList.remove("shuttle-docking");

        this.cargo = cargo;
        this.game.querySelector(".shuttle-cargo").textContent = cargo ? cargo.name : "No cargo";
        //const p = this.game.querySelector(".cargo");
        //if (cargo) {
        //    //const type = `${this.cargo.destination.type[0].toUpperCase()}${this.cargo.destination.type.slice(1)}`;
        //    //p.textContent =
        //    //    cargo.destination.type === "dock" ?
        //    //    //`Passenger\n${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}` :
        //    //    //`Passenger\n${type} on ${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}`;
        //    //    `Crewmember ${cargo.name}\n${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}` :
        //    //    `Crewmember ${cargo.name}\n${type} on ${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}`;
        //} else {
        //    //p.textContent = "";
        //    //this.message("Review", `${4 + Math.trunc(Math.random() * 2)} / 5 *`);
        //}
        //this.updateTarget();

        /*await new Promise(resolve => setTimeout(resolve, 0));
        this.game.classList.add("shuttle-undocking");
        bar.style.width = "100%";
        await new Promise(resolve => bar.addEventListener("transitionend", resolve, {once: true}));
        this.game.releaseShuttleLink();
        bar.style.width = "0%";
        this.game.classList.remove("shuttle-undocking");*/
    }

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
        this.game.classList.toggle("shuttle-assigned", mission)
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

        const pickup = this.game.getRandomLocation();
        const pickupDock = pickup.findNearestDock();
        let destination;
        let destinationDock = pickupDock;
        while (destinationDock === pickupDock) {
            destination = this.game.getRandomLocation();
            destinationDock = destination.findNearestDock();
        }

        const character = this.game.characters[Math.trunc(Math.random() * (this.game.characters.length - 1))];
        const event = ROLES[character.role].replace("{loc}", destination.name);

        (async () => {
            const h1 = this.game.querySelector(".mission");
            h1.textContent = `Mission ${this.game.level}`;
            await animate(h1, "fade");
            h1.textContent = "";
        })();
        // h1.style.animationName = "fade";

        await this.message(
            this.game.characters[this.game.characters.length - 1].name,
            // `${event} Find ${mission.character.name} at ${mission.pickup.name} and bring them over there ASAP!`
            `${event} Get ${character.name} over there ASAP!`
        );

        const bounds = this.game.fleet.map(ship => ship.bounds);
        const min = Math.min(...bounds.map(bounds => bounds.y));
        const max = Math.max(...bounds.map(bounds => bounds.y + bounds.height));
        console.log("MIN", min, "MAX", max);

        const nav = (from, to, color) => {
            //new DOMPoint(to.x, over),
            //const points = [
            //    from,
            //    new DOMPoint(from.x, over),
            //    new DOMPoint(to.x, over),
            //    to
            //];
            //const graph = new Map([[points[0], points[1]], [points[1], points[2]], [points[2], points[3]]]);

            const fromAbove = new DOMPoint(from.x, max);
            const fromBelow = new DOMPoint(from.x, min);
            const toAbove = new DOMPoint(to.x, max);
            const toBelow = new DOMPoint(to.x, min);
            const graph = new Map([
                [from, [fromAbove, fromBelow]],
                [fromAbove, [toAbove]],
                [toAbove, [to]],
                [fromBelow, [toBelow]],
                [toBelow, [to]]
            ]);
            console.log("GRAPH", graph);
            //const queue = [[[from], 0]];
            //while (queue.length) {
            //    const [path, dist] = queue.shift();
            //    const p = path[path.length - 1];
            //    for (let next of graph.get(p)) {
            //        queue.push(dist + Vector.abs(Vector.sub(next, p)), [...path, next]);
            //    }
            //}

            function getShortest(graph, from, to) {
                console.log("GET SHORT", from, to);
                if (from === to) {
                    return [[to], 0];
                }

                let minPath;
                let minDist = Infinity;
                for (let next of graph.get(from)) {
                    const dist = Vector.abs(Vector.sub(next, from));
                    let [path, pathDist] = getShortest(graph, next, to);
                    pathDist += Vector.abs(Vector.sub(next, from));
                    if (pathDist < minDist) {
                        minDist = pathDist;
                        minPath = [from, ...path];
                    }
                }
                return [minPath, minDist];
            }

            const [path, dist] = getShortest(graph, from, to);

            //let distance = 0;
            //for (let [p1, p2] of graph.entries()) {
            //    distance += Vector.abs(Vector.sub(p2, p1));
            //}
            //console.log("DISTANCE", distance);

            if (this.game.debug) {
                let edges = Array.from(graph.entries())
                    .map(([key, value]) => value.map(p => [key, p])).flat();
                edges = edges.map(
                    ([p1, p2]) => SVG.make("line", {x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: color})
                )
                console.log("EDGES", edges);
                const g = SVG.make("g");
                g.append(...edges);
                this.game.annotate("nav-grid" + color, g);

                const d = [
                    `M ${path[0].x} ${path[0].y}`,
                    ...path.slice(1).map(p => `L ${p.x} ${p.y}`)
                ].join(" ");
                this.game.annotate("nav" + color, SVG.make("path", {d, stroke: color, "stroke-width": 4}));
            }

            return dist;

            //if (this.game.debug) {
            //    const d = [
            //        `M ${points[0].x} ${points[0].y}`,
            //        ...points.slice(1).map(p => `L ${p.x} ${p.y}`)
            //    ].join(" ");
            //    this.game.annotate("nav" + color, SVG.make("path", {d, stroke: color, "stroke-width": w}));
            //}
        }

        const dist = nav(this.body.pos, pickupDock.parts[0].pos, "rgba(255, 0, 0, 0.5)") +
            nav(pickupDock.parts[0].pos, destinationDock.parts[0].pos, "rgba(0, 255, 0, 0.5)");
        console.log("DIST", dist);

        let time = null;
        if (this.game.level >= 2) {
            // 3 turns = 4 accel/deaccel a 2s
            const acceltime = 2 * 4 * 2;
            const acceldist = 2 * 4 * (UI.ENGINE * 2 * 2 / 2);
            console.log("ACCELDIST", acceldist, acceltime);
            //                                                                 docking with hin/weg rotation
            const lower = (dist - acceldist) / UI.TARGET_VELOCITY + acceltime + 2 * (1 + 2 + 1);
            console.log("LOWER TIME", lower, "s");

            const range = 3 - 1;
            // alternative: 1.5, 1.33
            const base = Math.pow((1.5 - 1) / range, 1 / 4);
            const m = Math.pow(base, this.game.level - 2) * range + 1;
            time = lower * m;
        }

        // mission design
        // three point approach:
        // upper = easy, should be doable by absolute beginners (level 0)
        // mid   = hard, should be doable only by experienced players (level 4)
        // lower = impossible, theoretical limit to approach (level inf)
        // base ** 4 * (upper - lower) + lower = mid
        // base ** 4 * (upper - lower) = mid - lower
        // base = ((mid - lower) / (upper - lower)) ** 1/4

        //const upper = lower * 3;
        //const mid = lower * 1.5; // alternative: 1.33
        //const base = Math.pow((mid - lower) / (upper - lower), 1 / 4);
        //const time = Math.pow(base, this.game.level - 1) * (upper - lower) + lower;

        // e.g. mission times for lower 60 mid 90 upper 120 / 180
        //>>> ((90 - 60) / (120 - 60)) ** (1/4)
        //0.8408964152537145
        //>>> ((90 - 60) / (180 - 60)) ** (1/4)
        //0.7071067811865476
        //>>> [0.84 ** i * (120 - 60) + 60 for i in [0, 2, 4, 6, 8]]
        //[120.0, 102.33599999999998, 89.8722816, 81.07788189696, 74.87255346649498]
        //>>> [0.71 ** i * (180 - 60) + 60 for i in [0, 2, 4, 6, 8]]
        //[180.0, 120.49199999999999, 90.4940172, 75.37203407051999, 67.74904237494913]


        //nav(this.body.pos, pickupDock.parts[0].pos, max, "lime", 3);
        //nav(this.body.pos, pickupDock.parts[0].pos, min, "green", 3);
        //nav(pickupDock.parts[0].pos, destinationDock.parts[0].pos, max, "red");
        //nav(pickupDock.parts[0].pos, destinationDock.parts[0].pos, min, "orange");

        const mission = new Mission(
            character, pickup, pickupDock, destination, destinationDock, time
        );
        this.assignMission(mission);

        // set mission

        // dock.tick() if no mission create mini mission
        // dock.tick() load cargo of mission
        // hello message

        // dock.tick() unload cargo of mission
        // closing message
    }

    updateTarget() {
        const p = this.game.querySelector(".shuttle-target");
        let target = "No target\n ";
        if (this.mission) {
            target = this.mission.target;
            const type = `${target.module.type[0].toUpperCase()}${target.module.type.slice(1)}`;
            target = target.module.type === "dock" ?
                //`Passenger\n${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}` :
                //`Passenger\n${type} on ${this.cargo.destination.ship.name}, dock ${this.cargo.dock.id}`;
                `${type} ${target.dock.id} on ${target.module.ship.name}` :
                `${type} on ${target.module.ship.name}, dock ${target.dock.id}`;
            //const time = (new Date() - this.mission.t) / 1000;
            //target += `\n${time.toFixed(1)} s`;
            const time = (new Date() - this.mission.t) / 1000;
            target += this.mission.time ? `\n${this.mission.time.toFixed(1)} s` : "\n ";
        }
        p.textContent = target;

        if (this.#missionPOI !== (this.mission?.poi ?? null)) {
            console.log("MP UPDATE");
            if (this.#missionPOI) {
                console.log("REMOVING OLD MP")
                this.removePOI(this.#missionPOI);
                this.#missionPOI = null;
            }
            if (this.mission) {
                console.log("ADDING NEW MP");
                this.#missionPOI = this.mission.poi;
                this.addPOI(this.#missionPOI);
            }
        }
    }

    addPOI(poi) {
        const node = SVG.make("g");
        const text = SVG.make("text", {y: 32});
        text.textContent = poi.label;
        node.append(SVG.make("path", {class: "poi", d: "M 0 0 L -8 16 L 8 16 Z"}), text);
        this.pois.set(poi, node);
        this.#navigation.append(node);
    }

    removePOI(poi) {
        const node = this.pois.get(poi);
        node.remove();
        this.pois.delete(poi);
    }

    tick(t) {
        const bounds = document.documentElement.getBoundingClientRect()
        const center = new DOMPoint(bounds.width / 2, bounds.height / 2);
        const r = Math.min(bounds.width, bounds.height) / 2 - 2 * 8;
        let smatrix = this.game.canvas.getScreenCTM();
        let matrix = new DOMMatrix([smatrix.a, smatrix.b, smatrix.c, smatrix.d, smatrix.e, smatrix.f]);
        for (let [poi, node] of this.pois.entries()) {
            // console.log("POI", poi, poi.body, poi.body.pos);
            let p = poi.body instanceof DOMPoint ? poi.body : poi.body.pos;
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
        if (!this.#fleetPOI && !Box.contains(fleetBounds, this.body.pos)) {
            this.#fleetPOI = new POI(new DOMPoint(0, 0), "Fleet");
            this.addPOI(this.#fleetPOI);
        }
        if (this.#fleetPOI && Box.contains(fleetBounds, this.body.pos)) {
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

class POI {
    body;
    label;

    constructor(body, label) {
        this.body = body;
        this.label = label;
    }
}

class Mission {
    target;
    poi;

    constructor(character, pickup, pickupDock, destination, destinationDock, time) {
        this.character = character;
        this.pickup = pickup;
        this.pickupDock = pickupDock;
        this.destination = destination;
        this.destinationDock = destinationDock;
        this.time = time;
        this.t = new Date();
        if (pickup) {
            this.target = new Target("pickup", pickup, pickupDock);
            this.poi = new POI(pickupDock.parts[0], character.name);
        } else {
            this.target = new Target("destination", destination, destinationDock);
            this.poi = new POI(destinationDock.parts[0], "Target");
        }
    }

    tick(t, game) {
        if (this.time !== null) {
            this.time -= t;
            if (this.time <= 0) {
                // animate(this.game.querySelector(".credits"), "fade-in");
                (async() => {
                    const credits = game.querySelector(".credits");
                    //this.game.classList.add("game-over");
                    //await new Promise(resolve => credits.addEventListener("transitionend", resolve, {once: true}));
                    credits.querySelector("span").textContent = game.level === 1 ?
                        `The fleet operated for 1 mission.`:
                        `The fleet operated for ${game.level} missions.`;
                    credits.querySelector("small").textContent = CONCLUSIONS[this.character.role];
                    game.classList.add("credits-rolling");
                    animate2(credits, "credits-fade-in");
                    await animate2(game.querySelector(".credits > div"), "credits-roll");
                    game.classList.add("game-over");
                    game.classList.add("opening");
                    game.classList.remove("credits-rolling");
                    // await transition(this.game, "game-over");
                    game.pause();
                    game.init();
                })();
                game.shuttle.assignMission(null);
            }
        }

        game.shuttle.updateTarget();

        switch (this.target.id) {
        case "pickup":
            if (game.shuttle.cargo) {
                this.target = new Target("destination", this.destination, this.destination.findNearestDock());
                this.poi = new POI(this.destinationDock.parts[0], POIS[this.character.role]);
                game.shuttle.updateTarget();
                game.shuttle.message(this.character.name, "Good to see you!");
            }
            break;
        case "destination":
            if (!game.shuttle.cargo) {
                game.shuttle.assignMission(null);
                if (this.pickup) {
                    game.shuttle.message(
                        game.characters[game.characters.length - 1].name,
                        `${this.character.name} has arrived. Good job!`
                    );
                } else {
                    game.shuttle.message("Review", `${4 + Math.trunc(Math.random() * 2)} / 5 *`);
                }
            }
            break;
        default:
            throw new Error();
        }
    }
}

class Target {
    id;
    module;
    dock;

    constructor(id, module, dock) {
        this.id = id;
        this.module = module;
        this.dock = dock;
    }
}

class Character {
    role;
    surname;

    constructor(role, surname) {
        this.role = role;
        this.surname = surname;
    }

    get name() {
        return `${this.role} ${this.surname}`;
    }
}

class Roulette {
    pockets;
    #total;

    constructor(pockets) {
        this.pockets = pockets;
        console.log("POCKETVALS", Array.from(this.pockets.values()));
        this.#total = sum(Array.from(this.pockets.values()));
    }

    spin() {
        const draw = Math.random() * this.#total;
        //console.log("SPIN", draw, this.#total);
        let curP = 0;
        for (let [item, p] of this.pockets.entries()) {
            curP += p;
            if (draw < curP) {
                return item;
            }
        }
    }
}

function distribute(items, bins, {capacity = Infinity, draw = null} = {}) {
    if (!draw) {
        draw = () => Math.trunc(Math.random() * bins.length);
    }
    if (capacity * bins.length - sum(bins.map(bin => bin.length)) < items.length) {
        throw new Error("NOT ENOUGH SPACE");
    }
    for (let item of shuffle(items)) {
        while (true) {
            const i = draw();
            if (i < 0 || i >= bins.length) {
                throw new RangeError("!!!");
            }
            // console.log("BIN I", i, bins[i].length);
            if (bins[i].length >= capacity) {
                continue;
            }
            bins[i].push(item);
            break;
        }
        // let k;
        // for (k = 0; k < 10; k++) {
        //if (k === 10) {
        //    throw new Error("ENDLESS LOOP");
        //}
    }
}

class FleetGenerator {
    generate() {
        const decks = 70 + Math.floor(Math.random() * (10 + 1));

        //const tr = new Roulette(new Map([["a", 5], ["b", 2], ["c", 3]]));
        //const counts = new Map();
        //for (let i = 0; i < 10000; i++) {
        //    const item = tr.spin();
        //    counts.set(item, (counts.get(item) ?? 0) + 1);
        //}
        //console.log("ROULETTE AFTER 10k SPINS", counts);

        //const bins = [...new Array(3)].map(() => []);
        //const roulette = new Roulette(new Map([[0, 6], [1, 3], [2, 1]]));
        //const items = new Array(10000).fill("test");
        //distribute(items, bins, {capacity: 5000, draw: () => roulette.spin()});
        //console.log("DISTRIBUTED", bins[0], bins[1], bins[2]);

        // 2 - 4
        // 2 * (16 - 4)
        // min: 4 * (13 + 3) = 52 / 12
        // max: 4 * (12 + 4) = 48 / 16

        // const CAPACITY = 16 - 4;
        // const BLOCKS = 2 * CAPACITY;
        const CAPACITY = 32 - 8; // max capacity of ship (8 blocks local)
        const BLOCKS = CAPACITY + (8 - 3); // max capacity of small ship (3 blocks local)

        let ships = [... new Array(2)].map(() => []);
        const indexBySize = new Roulette(
            new Map(Object.keys(ships).map(i => [parseInt(i), Math.random()]))
        );
        const blocks = new Array(BLOCKS).fill("quarters");
        // distribute(blocks, ships, {capacity: 2 * CAPACITY, draw: () => indexBySize.spin()});
        distribute(blocks, ships, {capacity: CAPACITY, draw: () => indexBySize.spin()});
        console.log("DISTRIBUTED", ships[0], ships[1]);

        //let quarters = [...new Array(3)].map(() => Math.random());
        //const total = sum(quarters);
        //quarters = quarters.map(share => Math.trunc(share / total * decks));
        //console.log("Q", quarters);
        //quarters[0] += decks - sum(quarters);
        //console.log("Q+R", quarters, decks);
        //quarters = quarters.map(q => ["quarters", q]);
        //const blueprint = shuffle(quarters);
        // return [this.#generateShip(blueprint, new DOMPoint(100, 20))];

        ships = ships.map(ship => this.#generateShip(ship));
        const span =
            sum(ships.map(ship => ship.modules[0].length * Ship.MODULE_WIDTH)) +
            (ships.length - 1) * 2 * Ship.MODULE_WIDTH;
        let x = -span / 2;
        for (let ship of ships) {
            const pos = x + ship.modules[0].length * Ship.MODULE_WIDTH / 2;
            for (let row of ship.modules) {
                for (let module of row) {
                    for (let part of module.parts) {
                        part.update(Vector.add(part.pos, new DOMPoint(pos, 0)), 0);
                    }
                }
            }
            x += (ship.modules[0].length + 2) * Ship.MODULE_WIDTH;
        }
        return ships;
    }

    #generateShip(blueprint) {
        // one dock every 8 blocks, last one optional
        const docks =
            Math.min(Math.ceil(blueprint.length / 7), 3) +
            (blueprint.length > 21 ? Math.trunc(Math.random() * 2) : 0);
        blueprint = [...blueprint, ...new Array(docks).fill("dock")];
        if (blueprint.length % 2 !== 0) {
            blueprint.push("quarters");
        }
        blueprint = shuffle(blueprint);

        const step = (blueprint.length + 2) > 8 ? 2 : 1;
        blueprint.unshift(...new Array(step).fill("engineBow"));
        blueprint.push(... new Array(step).fill("engineStern"));

        console.log("BLUEPRINT", blueprint);

        const generate = {
            quarters: (...args) => this.#generateShipDecks(...args),
            engineStern: (...args) => this.#generateEngineStern(...args),
            engineBow: (...args) => this.#generateEngineBow(...args),
            dock: (...args) => this.#generateShipDock(...args)
        };


        const color = `hsl(${Math.trunc(Math.random() * 360)}, 50%, 50%)`;
        // const name = "Camelopardalis";
        // const name = "Aquarius";
        const name = SHIP_NAMES[Math.trunc(Math.random() * SHIP_NAMES.length)];
        const ship = new Ship(name, color);

        // const step = blueprint.length > 16 ? 2 : 1;
        const width = step * Ship.MODULE_WIDTH;
        const height = blueprint.length / 2 * Ship.MODULE_HEIGHT;
        for (let y = 0; y < blueprint.length / step; y++) {
            const row = [];
            ship.modules.push(row);
            for (let x = 0; x < step; x++) {
                const i = y * step + x;
                const module = generate[blueprint[i]](x === 0, x === step - 1, ship); // (step === 1 ? Math.trunc(Math.random() * 2) : x);
                for (let part of module.parts) {
                    const pos = new DOMPoint(
                        // x * Ship.MODULE_WIDTH - width / 2, y * Ship.MODULE_HEIGHT - height / 2
                        x * Ship.MODULE_WIDTH - width / 2 + Ship.MODULE_WIDTH / 2,
                        height / 2 - y * Ship.MODULE_HEIGHT - Ship.MODULE_HEIGHT / 2
                    );
                    part.update(Vector.add(part.pos, pos), 0);
                }
                row.push(module);
            }
        }
        return ship;

        // {dock: Math.ceil(decks / 40)}
        //blueprint = [
        //    ["engineStern", 4], shuffle([...blueprint, ["dock", 4], ["dock", 4]]), ["engineBow", 2]
        //];
        // Object.entries(blueprint).map((type, decks) => 

        //const cells = 20 + Math.floor(Math.random() * (10 + 1));

        //const modules = blueprint.map(([type, decks]) => generate[type](cells, decks));

        //const xmodules = [];
        //xmodules.push(this.#generateShipDecks(cells));
        //xmodules.push(this.#generateShipDock(cells));
        //xmodules.push(this.#generateShipDecks(cells));
        //xmodules.push(this.#generateShipDecks(cells));
        //xmodules.push(this.#generateShipDecks(cells));
        //xmodules.push(this.#generateShipDock(cells));
        //xmodules.push(this.#generateShipDecks(cells));
        //let y = position.y;
        //for (let module of xmodules) {
        //    const height = module.shape.bounds.height;
        //    module.update(new DOMPoint(position.x, y + module.shape.bounds.height / 2), 0);
        //    y += height;
        //}
        //console.log(xmodules);
        //return new Ship(xmodules);
    }

    #generateShipDecks(port, starboard, ship) {
        const cells = 10;
        // const decks = 20 + Math.floor(Math.random() * (10 + 1));
        // const decks = 70 + Math.floor(Math.random() * (10 + 1));
        // const decks = 4 + Math.floor(Math.random() * (4 + 1));
        // const decks = 12;
        const decks = 5;

        // const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); // new SVGRectElement();
        const g = SVG.make("g", {class: "ship-quarters"});

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); // new SVGRectElement();
        g.append(rect);

        const width = cells * 4; // + 2;
        const height = decks * 4; // + 2;
        const left = -width / 2;
        const bottom = -height / 2;
        rect.setAttribute("width", width + 0.2);
        rect.setAttribute("height", height + 0.2);
        rect.setAttribute("x", left - 0.1);
        rect.setAttribute("y", bottom - 0.1);
        /*rect.setAttribute("rx", 1);
        rect.setAttribute("ry", 1);*/
        //rect.style.fill = "silver";
        const skip = Math.floor(Math.random() * cells);
        g.append(this.#generatePortholes(new DOMPoint(left, bottom), cells, decks, {skip}));
        /*for (let y = 0; y < decks; y++) {
            for (let x = 0; x < cells; x++) {
                if (x === skip) {
                    continue;
                }
                //const w = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                //w.setAttribute("width", 1);
                //w.setAttribute("height", 2);
                //w.setAttribute("x", left + 4 * x + 1);
                //w.setAttribute("y", bottom + 4 * y + 1);
                // const on = Math.random() <= 2 / 3 ? "ship-window-on" : "";
                const on = Math.random() <= 0.5 ? "ship-window-on" : "";
                //g.append(
                //    SVG.make("rect", {class: `ship-window ${on}`, width: 0.75, height: 2, x: left + 4 * x + 1, y: bottom + 4 * y + 1}),
                //    SVG.make("rect", {class: `ship-window ${on}`, width: 0.75, height: 2, x: left + 4 * x + 2.25, y: bottom + 4 * y + 1})
                //);
                //g.append(
                //    SVG.make("rect", {class: `ship-window ${on}`, width: 1, height: 2, x: left + 4 * x + 1, y: bottom + 4 * y + 1, rx: 0.5, ry: 0.5}),
                //    SVG.make("rect", {class: `ship-window ${on}`, width: 1, height: 2, x: left + 4 * x + 2.5, y: bottom + 4 * y + 1, rx: 0.5, ry: 0.5})
                //);
                //g.append(
                //    SVG.make("rect", {class: `ship-window ${on}`, width: 2, height: 1, x: left + 4 * x + 1, y: bottom + 4 * y + 1.5, rx: 0.25, ry: 0.25})
                //);
                g.append(
                    SVG.make("rect", {class: `ship-window ${on}`, width: 2, height: 1.5, x: left + 4 * x + 1, y: bottom + 4 * y + 1, rx: 0.25, ry: 0.25})
                );
                //g.append(
                //    SVG.make("rect", {class: `ship-window ${on}`, width: 1, height: 2, x: left + 2 * x + 1, y: bottom + 4 * y + 1, rx: 0.5, ry: 0.5})
                //);
                //w.setAttribute("width", 2);
                //w.setAttribute("height", 1);
                //w.setAttribute("x", left + 4 * x + 1);
                //w.setAttribute("y", bottom + 4 * y + 1.5);
                //w.setAttribute("rx", 0.25);
                //w.setAttribute("ry", 0.25);
                //w.style.fill = Math.random() <= 2 / 3 ? "yellow" : "#333";
                //g.append(w);
            }
        }*/

        const entity = new Entity(g, Polygon.fromRect(left, bottom, width, height), Infinity);
        //entity.update(new DOMPoint(100, 100), 0);
        //entity.pos = new Vector(-left, 0);
        // entity.v = new Vector(0, 10);
        // entity.vRot = Math.PI / 8;
        return new Module("quarters", [entity], ship);
    }

    #generateShipDock(port, starboard, ship) {
        const cells = 10;
        const width = cells * 4 + 0.2; // + 2;
        // const height = 2 * 4;
        const height = Ship.MODULE_HEIGHT + 0.2;
        const left = -width / 2;
        const bottom = -height / 2;
        const g = SVG.make("g", {class: "ship-dock"});
        const rect = SVG.make("rect", {fill: "#ccc", x: -width / 2, y: -height / 2, width, height});
        let lock;
        const text = SVG.make("text", {fill: ship.color});
        const id = String.fromCharCode(
            "A".charCodeAt(0) + ship.modules.flat().filter(module => module.type === "dock").length
        );
        // const id = ["A", "B", "C", "D"][Math.trunc(Math.random() * 4)];
        text.textContent = id;
        let hot;
        let portholes;
        if (port) {
            hot = Polygon.fromRect(left - 1, bottom + 5.5, 1, 5);
            lock = SVG.make(
                "rect",
                {fill: "url(#lock-gradient-v)", x: left - 1, y: bottom + 5.5, width: 1, height: 5}
            );
            text.style.transform = `translate(${left + 1}px, ${bottom + 8}px) rotate(-90deg) scaleY(-1)`;
            portholes = this.#generatePortholes(new DOMPoint(left + 8, bottom + 4), 2, 2);
        } else {
            hot = Polygon.fromRect(left + width, bottom + 5.5, 1, 5);
            lock = SVG.make(
                "rect",
                {fill: "url(#lock-gradient-v)", x: left + width, y: bottom + 5.5, width: 1, height: 5}
            );
            text.style.transform = `translate(${left + width - 1}px, ${bottom + 8}px) rotate(90deg) scaleY(-1)`;
            portholes = this.#generatePortholes(new DOMPoint(left + width - 16, bottom + 4), 2, 2);
        }
        g.append(rect, lock, text, portholes);
        return new Dock(
            [new Entity(g, Polygon.fromRect(-width / 2, -height / 2, width, height), Infinity)],
            ship, id, hot
        );
    }

    #generateEngineBow(port, starboard, context) {
        console.log("PORT", port, starboard);
        const width = Ship.MODULE_WIDTH + 2 * Ship.BLEED;
        const height = 16 + 2 * Ship.BLEED;
        const l = -Ship.MODULE_WIDTH / 2 - Ship.BLEED;
        const b = -Ship.MODULE_HEIGHT / 2 - Ship.BLEED;
        const leftCorner = port ?
            `L ${l} ${b + height - 1} A 1 1 0 0 0 ${l + 1} ${b + height}` : `L ${l} ${b + height}`;
        const rightCorner = starboard ?
            `L ${l + width - 1} ${b + height} A 1 1 0 0 0 ${l + width} ${b + height - 1}` :
            `L ${l + width} ${b + height}`;
        const g = SVG.make("g", {class: "ship-bow"});
        g.append(
            SVG.make(
                "rect",
                {
                    class: "ship-body",
                    x: l,
                    y: b,
                    width,
                    height: 8 + 2 * Ship.BLEED
                    // d: `M ${l} ${b} L ${l} ${rightCorner} L ${l + width} ${b} Z`
                }
            ),
            SVG.make(
                "path",
                {
                    class: "ship-engine-bow",
                    d: `M ${l} ${b + 8} ${leftCorner} ${rightCorner} L ${l + width} ${b + 8} Z`
                }
            )
        );

        // TODO longer names, different names
        // TODO ABC for docks
        //   TODO bold or heavy? (also for logo)

        // TODO for broad ship text next to bridge?

        // XXX should be property
        /*text = SVG.make("text", {x: l + 20, y: -(b + 1 + 2), fill: ship.color});
        text.textContent = "AQUARIUS";
        g.append(text);*/
                //this.#generatePortholes(new DOMPoint(l, b + 4), 2, 1, {light: 1}),
                //this.#generatePortholes(new DOMPoint(l + 12, b + 4), 1, 1, {width: 14, light: 1}),
                //this.#generatePortholes(new DOMPoint(l + width - 8, b + 4), 2, 1, {light: 1})

        if (starboard) {
            const y = port ? -(b + 1) : -(b + 4 + 1);
            let text = SVG.make("text", {x: l + 20, y, fill: context.color});
            text.textContent = context.name.toUpperCase();
            g.append(text);
        }

        if (port) {
            g.append(
                this.#generatePortholes(new DOMPoint(l + 8, b + 4), 1, 1, {light: 1}),
                this.#generatePortholes(new DOMPoint(l + 12, b + 4), 1, 1, {width: 14, light: 1}),
                this.#generatePortholes(new DOMPoint(l + 28, b + 4), 1, 1, {light: 1})
            );
        }


        /*if (port && starboard) {
            g.append(
                this.#generatePortholes(new DOMPoint(l + 8, b + 4), 1, 1, {light: 1}),
                this.#generatePortholes(new DOMPoint(l + 12, b + 4), 1, 1, {width: 14, light: 1}),
                this.#generatePortholes(new DOMPoint(l + 28, b + 4), 1, 1, {light: 1})
            );
        } else {
            g.append(
                this.#generatePortholes(new DOMPoint(port ? l + 20: l + 16, b + 4), 1, 1, {light: 1}),
                this.#generatePortholes(new DOMPoint(port ? l + 24: l, b + 4), 1, 1, {width: 14, light: 1}),
            );
        }*/

        // TODO better hitbox
        return new Module(
            "bridge", [new Entity(g, Polygon.fromRect(l, b, width, height), Infinity)], context
        );
    }

    #generateEngineStern(port, starboard, ship) {
        // TODO: gradient
        // TODO: slimmer design
        const parts = [];
        function generateThruster() {
            return new Entity(
                SVG.make(
                    "path",
                    // {class: "ship-engine-bow", d: "M -4 -10 L -4 8 A 4 2 0 0 0 4 8 L 4 -10 Z"}
                    {class: "ship-engine-bow", d: "M -10 -10 L -10 8 A 4 2 0 0 0 -6 10 L 6 10 A 4 2 0 0 0 10 8 L 10 -10 Z"}
                ),
                Polygon.fromRect(-4, -10, 8, 20), Infinity
            );
        }

        const thruster = SVG.make("rect", {x: -10, y: -10, width: 20, height: 4, fill: "url(#thruster-gradient)"});
        parts.push(new Entity(thruster, Polygon.fromRect(-10, -10, 20, 4), Infinity));

        const w = Ship.MODULE_WIDTH + 2 * Ship.BLEED;
        const h = 4 * Ship.UNIT + 2 * Ship.BLEED;
        const l = -w / 2;
        const b = -1.5 * Ship.UNIT - Ship.BLEED;
        const leftCorner = port ?
            `L ${l + 1} ${b} A 1 1 0 0 0 ${l} ${b + 1}` : `L ${l} ${b}`;
        const rightCorner = starboard ?
            `L ${l + w} ${b + 1} A 1 1 0 0 0 ${l + w - 1} ${b}` : `L ${l + w} ${b}`;
        const path = SVG.make(
            "path",
            {
                class: "ship-engine-bow",
                d: `M ${l} ${b + h} L ${l + w} ${b + h} ${rightCorner} ${leftCorner} Z`
            }
        );

        //const rect = SVG.make(
        //    "rect",
        //    {
        //        class: "ship-engine-bow",
        //        /*x: -Ship.MODULE_WIDTH / 2 - Ship.BLEED,
        //        y: -Ship.MODULE_HEIGHT / 2 - Ship.BLEED + Ship.UNIT,
        //        width: Ship.MODULE_WIDTH + 2 * Ship.BLEED,
        //        height: 4 * Ship.UNIT + 2 * Ship.BLEED,*/
        //        x: -20.1,
        //        y: -6.1,
        //        width: 40.2,
        //        height: 16.2
        //    }
        //);
        parts.push(new Entity(path, Polygon.fromRect(-20, -6, 40, 16), Infinity));
        /*if (port) {
            const thruster = generateThruster();
            thruster.update(new DOMPoint(-14, 0), 0);
            parts.push(thruster);
        }
        if (starboard) {
            const thruster = generateThruster();
            thruster.update(new DOMPoint(14, 0), 0);
            parts.push(thruster);
        }*/
        return new Module("engine", parts, ship);
    }

    #generatePortholes(p, columns, rows, {width = 2, light = 0.5, skip = -1} = {}) {
        const fragment = document.createDocumentFragment();
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                if (x === skip) {
                    continue;
                }
                const on = Math.random() <= light ? "ship-window-on" : "";
                fragment.append(
                    SVG.make(
                        "rect",
                        {
                            class: `ship-window ${on}`,
                            width,
                            height: 1.5,
                            x: p.x + 4 * x + 1,
                            y: p.y + 4 * y + 1,
                            rx: 0.25,
                            ry: 0.25
                        }
                    )
                );
            }
        }
        return fragment;
    }
}

class UI extends HTMLElement {
    ship;
    fleet;
    #shuttleNode;
    #thrusters;

    t;
    #keys = new Set();
    #control = new DOMPoint();

    #entities = [];
    #joints = new Set();
    #annotations = new Map();

    #options = {rotateCam: true, debug: false, cruise: true};
    #info;
    #stars;

    #second;
    #frames = 0;
    #fps = 0;
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

        this.#generator = new FleetGenerator();

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
                this.releaseShuttleLink();
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

    releaseShuttleLink() {
        if (this.shuttle.links.size) {
            for (let joint of this.shuttle.links) {
                this.#joints.delete(joint);
                joint.node.remove();
                if (this.#options.debug) {
                    this.#annotations.get(joint).remove();
                }
            }
            this.shuttle.links.clear();
            this.classList.remove("shuttle-linked");
        }
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
                this.releaseShuttleLink();
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
            //this.#entities[0].pos = new Vector(100, 200);
            this.#info = this.querySelector(".info .content");

            this.#init();
            this.t = new Date();
            this.#second = this.t;
            requestAnimationFrame(() => this.step());
            //this.play();

            /*
            // colortest
            this.canvas.append(
                SVG.make("rect", {x: "-60", y: "-20", width: "110", height: "60", fill: "#fff"}),
                SVG.make("rect", {x: "-20", y: "-20", width: "110", height: "60", fill: "#808080"}),
                SVG.make("rect", {x: "20", y: "-20", width: "110", height: "60", fill: "#000"})
            );
            for (let i = 0; i < 16; i++) {
                for (let x = 0; x < 11; x++) {
                    const text = SVG.make("text", {x: -59 + x * 10, y: 19 - i * 3});
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

    step() {
        //this.#stars.firstElementChild.style.transform = `rotate(${new Date().valueOf() / 10000}rad)`;
        //requestAnimationFrame(() => this.step());
        //return;

        const now = new Date();
        const t = (now - this.t) / 1000;
        this.t = now;

        this.#frames++;
        if (this.t >= this.#second) {
            this.#fps = this.#frames;
            this.#frames = 0;
            this.#second = new Date(this.#second.valueOf() + 1000);
        }

        // basic 4 point nav route to compute therotical limit :)
        // (overestimates 2 directly next to each other, but rest is cool)

        this.#info.textContent = [
            `${this.#fps} FPS`,
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
            for (let entity of this.#entities) {
                // Apply rotational velocity
                const rot = entity.rot + entity.spin * t;
                // Apply linear velocity
                const pos = Vec.add(entity.pos, Vec.mul(entity.velocity, t));
                entity.update(pos, rot);
            }
            for (let joint of this.#joints) {
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
        //this.ship.rot += Math.PI / 100;

        // camera
        //const rot = entity.rot - this.ship.rot;
        // const camPos = new Vector();
        // const pos = entity.pos; // entity.pos.sub(this.ship.pos);
        camRot = this.#options.rotateCam ? this.ship.rot : 0;
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
        camPos = Vector.add(this.ship.pos, v === 0 ? new DOMPoint() : Vector.mul(this.ship.velocity, view / 2 / v));
        // const camPos = this.ship.pos;
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

        for (let entity of this.#entities) {
            // const pos = entity.pos.sub(this.ship.pos);
            entity.node.style.transform =
                // global cam
                `translate(${entity.pos.x}px, ${entity.pos.y}px) rotate(${entity.rot}rad)`;
                // individual cam
                // `rotate(${-camRot}rad) translate(${-camPos.x}px, ${-camPos.y}px) translate(${entity.pos.x}px, ${entity.pos.y}px) rotate(${entity.rot}rad)`;
        }
        for (let joint of this.#joints) {
            joint.node.style.transform = `translate(${joint.position.x}px, ${joint.position.y}px)`;
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

        if (!this.paused) {
            for (let ship of this.fleet) {
                ship.tick(this);
            }
            if (this.shuttle.mission) {
                this.shuttle.mission.tick(t, this);
            }
            this.shuttle.tick(t);
        }

        requestAnimationFrame(() => this.step());
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

        const dir = new DOMPoint(-Math.sin(this.ship.rot), Math.cos(this.ship.rot));
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
                //console.log(
                //    "VREL PRE AFT", v, Vector.dot(
                //        Vector.sub(b.getVelocityAt(pb), a.getVelocityAt(pa)),
                //    normal), Vector.dot(vd, normal)
                //);
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
                const annotation = SVG.make("g", {class: "joint"}); // {class: `joint ${drifting ? "drifting" : ""}`});
                const dvaStop = Vector.add(anchorA, dva);
                const dvbStop = Vector.add(anchorB, dvb);
                // console.log(anchorA, dva, dvaStop);
                annotation.append(
                    SVG.make("circle", {cx: anchorA.x, cy: anchorA.y, r: 0.5}),
                    SVG.make("line", {x1: anchorA.x, y1: anchorA.y, x2: dvaStop.x, y2: dvaStop.y}),
                    SVG.make("circle", {cx: anchorB.x, cy: anchorB.y, r: 0.5}),
                    SVG.make("line", {x1: anchorB.x, y1: anchorB.y, x2: dvbStop.x, y2: dvbStop.y})
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
                            collision.edge[0] === a.hitbox.vertices[5] &&
                            collision.edge[1] === a.hitbox.vertices[0]
                        ) || collision.vertex === a.hitbox.vertices[5] ||
                        collision.vertex === a.hitbox.vertices[0]
                    ) {
                        stickyedge = true;
                    }
                }

                let p = collision.vertex;
                const DELTA = 0.1;
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
                // if (a === this.ship && stickyedge && (!this.ship.joint || this.ship.joint?.entityB === b)) {
                if (
                    a === this.shuttle.body && stickyedge &&
                    (!this.shuttle.links.size || this.shuttle.links.values().next().value.entityB === b)
                ) {
                    // console.log("NEW JOINT", collision.distance);
                    const joint = new Joint(
                        //this.ship, new DOMPoint(0, 8), container, new DOMPoint(0, -1.25)
                        //collision.a, collision.a.matrix.inverse().transformPoint(collision.vertex),
                        //collision.b, collision.b.matrix.inverse().transformPoint(collision.vertex)
                        a, a.matrix.inverse().transformPoint(p),
                        b, b.matrix.inverse().transformPoint(p),
                        SVG.make("circle", {r: 0.5, fill: "url(#spark-gradient)"})
                    );
                    this.shuttle.links.add(joint);
                    this.#joints.add(joint);
                    this.#entityLayer.append(joint.node);
                    this.classList.add("shuttle-linked");
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

    init() {
        // XXX
        this.#init();
    }

    #init() {
        this.#entities = [];
        this.#joints = new Set();
        this.#annotations = new Map();
        this.level = 0;

        this.#entityLayer.textContent = "";
        this.#annotationLayer.textContent = "";

        //this.#entities = Array.from(
        //    this.querySelectorAll(".object"),
        //    path => {
        //        // const bbox = path.getBBox();
        //        return new Entity(
        //            // path, Polygon.fromRect(bbox.x, bbox.y, bbox.width, bbox.height), 10000
        //            path,
        //            new Polygon(
        //                // TODO fix hexagon better
        //                [new DOMPoint(-2, -4), new DOMPoint(-2, 0), new DOMPoint(-1, 4),
        //                 new DOMPoint(1, 4),
        //                 new DOMPoint(2, 0), new DOMPoint(2, -4)]),
        //            10000
        //        );
        //    }
        //);
        this.ship = new Entity(
            this.#shuttleNode,
            new Polygon(
                // TODO fix hexagon better
                [new DOMPoint(-2, -4), new DOMPoint(-2, 0), new DOMPoint(-1, 4),
                 new DOMPoint(1, 4),
                 new DOMPoint(2, 0), new DOMPoint(2, -4)]),
            10000
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
        // this.ship.update(Vector.add(ship.parts[ship.parts.length - 1].pos, new DOMPoint(30, 0)), 0);

        //this.#createContainer(new DOMPoint(0, 50 + 8 + 2.5 / 2));
        //this.#createContainer(new DOMPoint(-10, 70 + 8 + 2.5 / 2));
        //this.#createContainer(new DOMPoint(10, 90 + 8 + 2.5 / 2));

        this.characters = Object.keys(ROLES).map(
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
        const container = new Entity(rect, shape, 1000); // 2.5 * 1000); // 1);
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
        const g = SVG.make("g");
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
        // g.append(SVG.make("rect", {x: x - size / 2, y: y - size / 2, width: size, height: size, stroke: "red"}));
        for (let i = 0; i < count; i++) {
            const s = Math.random();
            const r = Math.sqrt(Math.random()) * size / 2;
            const phi = Math.random() * 2 * Math.PI;
            g.append(
                SVG.make(
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
}
customElements.define("fleet-ui", UI);

function shuffle(array) {
    return array.map(item => [item, Math.random()])
        .sort((a, b) => b[1] - a[1])
        .map(item => item[0]);
}

function sum(array) {
    return array.reduce((previousValue, currentValue) => previousValue + currentValue);
}

class Joint {
    entityA;
    anchorA;
    entityB;
    anchorB;
    node;
    position;

    constructor(entityA, anchorA, entityB, anchorB, node) {
        this.entityA = entityA;
        this.anchorA = anchorA;
        this.entityB = entityB;
        this.anchorB = anchorB;
        this.node = node;
        this.update();
    }

    update() {
        this.position = this.entityA.matrix.transformPoint(this.anchorA);
    }
};
