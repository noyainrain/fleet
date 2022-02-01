/**
 * Missions module TODO.
 *
 * @module
 */

import {POI} from "./core.js";
import {Cargo, DockingEvent} from "./game.js";
import {Vector, animate2} from "./util.js";

/** @type {Object<string, string>} */
const ROLES = {
    captain: "An emergency meeting has been called at {loc}.",
    navigator: "There is an urgent meeting at {loc}.",
    engineer: "We have a technical problem at {loc}.",
    doctor: "We have a medical emergency at {loc}.",
    guard: "An offense has been reported at {loc}.",
    logistician: "We have some problematic cargo at {loc}.",
    scientist: "Something went wrong with the experiment running at {loc}."
};

/** @type {Object<string, string>} */
const POIS = {
    captain: "Emergency meeting",
    navigator: "Urgent meeting",
    engineer: "Technical problem",
    doctor: "Medical emergency",
    guard: "Offense",
    logistician: "Problematic cargo",
    scientist: "Bad experiment"
};

const CONCLUSIONS = {
    captain: "Then there was a mutiny.",
    navigator: "Then there was a navigation mishap.",
    engineer: "Then the computers crashed.",
    doctor: "Then there was a tragic accident.",
    guard: "Then a traitor took control.",
    logistician: "Then there was some toxic cargo.",
    scientist: "Then there was an outbreak."
};

export class MissionEvent extends Event {
    mission;

    constructor(type, init) {
        super(type, init);
        this.mission = init.mission;
    }
}

/** Cargo transport mission. */
export class Mission extends EventTarget {
    /** @type {POI} */
    #poi;
    #alarm = new AbortController();

    /**
     * @param {number} level - TODO.
     * @param {import("../fleet.js").UI} game - TODO.
     */
    constructor(level, game) {
        super();
        const pickup = game.getRandomLocation();
        const pickupDock = pickup.findNearestDock();
        let destination = pickup;
        let destinationDock = pickupDock;
        while (destinationDock === pickupDock) {
            destination = game.getRandomLocation();
            destinationDock = destination.findNearestDock();
        }

        const character = game.characters[Math.trunc(Math.random() * (game.characters.length - 1))];
        const event = ROLES[character.role].replace("{loc}", destination.name);

        // XXX
        //this.character = character;
        //this.pickup = pickup;
        //this.pickupDock = pickupDock;
        //this.destination = destination;
        //this.destinationDock = destinationDock;

        this.game = game;
        this.level = level;
        // TODO messages
        this.cargo = new Cargo(character, destination, destinationDock, {
            label: POIS[character.role],
            pickUpMessage: {from: character.name, text: "Good to see you!"}
        });
        pickupDock.cargo = this.cargo;
        this.#poi = new POI(pickupDock.parts[0], character.name);

        /* @type {?number} */
        // this.time = null;

        /** @param {Event} event */
        const onDock = event => {
            if (!(event instanceof DockingEvent)) {
                throw new Error();
            }
            if (event.incoming === this.cargo) {
                game.shuttle.removePOI(this.#poi);
            }
            if (event.outgoing === this.cargo) {
                game.shuttle.message(
                    game.characters[game.characters.length - 1].name,
                    `${this.cargo.load.name} has arrived. Good job!`
                );
                this.#alarm.abort();
                this.game.shuttle.alarm = null;
                game.shuttle.removeEventListener("dock", onDock);
                this.dispatchEvent(new MissionEvent("missionend", {mission: this}));
            }
        };
        game.shuttle.addEventListener("dock", onDock);

        (async () => {
            await game.shuttle.message(
                game.characters[game.characters.length - 1].name,
                `${event} Get ${character.name} over there ASAP!`
            );
            game.shuttle.addPOI(this.#poi);

            //if (pickup) {
            //    this.target = new Target("pickup", pickup, pickupDock);
            //    this.poi = new POI(pickupDock.parts[0], character.name);
            //    this.dock = pickupDock;
            //} else {
            //    this.target = new Target("destination", destination, destinationDock);
            //    this.poi = new POI(destinationDock.parts[0], "Target");
            //    this.dock = destination.dock;
            //}

            const bounds = game.fleet.map(ship => ship.bounds);
            const min = Math.min(...bounds.map(bounds => bounds.y));
            const max = Math.max(...bounds.map(bounds => bounds.y + bounds.height));
            console.log("MIN", min, "MAX", max);

            /**
             * @param {DOMPoint} from
             * @param {DOMPoint} to
             * @param {string} color
             */
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

                /**
                 * @param {Map<DOMPoint, DOMPoint[]>} graph
                 * @param {DOMPoint} from
                 * @param {DOMPoint} to
                 * @return {[DOMPoint[], number]}
                 */
                function getShortest(graph, from, to) {
                    console.log("GET SHORT", from, to);
                    if (from === to) {
                        return [[to], 0];
                    }

                    /** @type {DOMPoint[]} */
                    let minPath = [];
                    let minDist = Infinity;
                    const edges = graph.get(from);
                    if (!edges) {
                        throw new Error("ARGS!!!");
                    }
                    for (let next of edges) {
                        // const dist = Vector.abs(Vector.sub(next, from));
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

                if (game.debug) {
                    let edges = Array.from(graph.entries())
                        .map(([key, value]) => value.map(p => [key, p])).flat();
                    edges = edges.map(
                        ([p1, p2]) => createSVGElement("line", {x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: color})
                    )
                    console.log("EDGES", edges);
                    const g = createSVGElement("g");
                    g.append(...edges);
                    game.annotate("nav-grid" + color, g);

                    const d = [
                        `M ${path[0].x} ${path[0].y}`,
                        ...path.slice(1).map(p => `L ${p.x} ${p.y}`)
                    ].join(" ");
                    game.annotate("nav" + color, createSVGElement("path", {d, stroke: color, "stroke-width": 4}));
                }

                return dist;

                //if (game.debug) {
                //    const d = [
                //        `M ${points[0].x} ${points[0].y}`,
                //        ...points.slice(1).map(p => `L ${p.x} ${p.y}`)
                //    ].join(" ");
                //    game.annotate("nav" + color, createSVGElement("path", {d, stroke: color, "stroke-width": w}));
                //}
            }

            const dist = nav(game.shuttle.body.position, pickupDock.parts[0].position, "rgba(255, 0, 0, 0.5)") +
                nav(pickupDock.parts[0].position, destinationDock.parts[0].position, "rgba(0, 255, 0, 0.5)");
            console.log("DIST", dist);

            // XXX
            const UI_ENGINE = 9.80665 * 2.5; // m / s2; reached in 2s
            const UI_TARGET_VELOCITY = 50; // m / s

            let time = null;
            if (this.level >= 2) {
                // 3 turns = 4 accel/deaccel a 2s
                const acceltime = 2 * 4 * 2;
                const acceldist = 2 * 4 * (UI_ENGINE * 2 * 2 / 2);
                console.log("ACCELDIST", acceldist, acceltime);
                //                                                                 docking with hin/weg rotation
                const lower = (dist - acceldist) / UI_TARGET_VELOCITY + acceltime + 2 * (1 + 2 + 1);
                console.log("LOWER TIME", lower, "s");

                const range = 3 - 1;
                // alternative: 1.5, 1.33
                const base = Math.pow((1.5 - 1) / range, 1 / 4);
                const m = Math.pow(base, level - 2) * range + 1;
                time = lower * m;

                (async () => {
                    this.game.shuttle.alarm = this.game.world.now + time;
                    try {
                        await this.game.world.setAlarm(
                            this.game.world.now + time, {signal: this.#alarm.signal}
                        );
                    } catch (e) {
                        if (e instanceof DOMException && e.name === "AbortError") {
                            return;
                        }
                        throw e;
                    }

                    this.game.shuttle.removePOI(this.#poi);
                    this.dispatchEvent(new MissionEvent("missionend", {mission: this}));
                    // TODO game.end()
                    const credits = game.querySelector(".credits");
                    //this.game.classList.add("game-over");
                    //await new Promise(resolve => credits.addEventListener("transitionend", resolve, {once: true}));
                    credits.querySelector("span").textContent = game.level === 1 ?
                        "The fleet operated for 1 mission." :
                        `The fleet operated for ${game.level} missions.`;
                    credits.querySelector("small").textContent = CONCLUSIONS[this.cargo.load.role];
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
            }

            // this.time = time;

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
            //const time = Math.pow(base, level - 1) * (upper - lower) + lower;

            // e.g. mission times for lower 60 mid 90 upper 120 / 180
            //>>> ((90 - 60) / (120 - 60)) ** (1/4)
            //0.8408964152537145
            //>>> ((90 - 60) / (180 - 60)) ** (1/4)
            //0.7071067811865476
            //>>> [0.84 ** i * (120 - 60) + 60 for i in [0, 2, 4, 6, 8]]
            //[120.0, 102.33599999999998, 89.8722816, 81.07788189696, 74.87255346649498]
            //>>> [0.71 ** i * (180 - 60) + 60 for i in [0, 2, 4, 6, 8]]
            //[180.0, 120.49199999999999, 90.4940172, 75.37203407051999, 67.74904237494913]


            //nav(this.body.position, pickupDock.parts[0].position, max, "lime", 3);
            //nav(this.body.position, pickupDock.parts[0].position, min, "green", 3);
            //nav(pickupDock.parts[0].position, destinationDock.parts[0].position, max, "red");
            //nav(pickupDock.parts[0].position, destinationDock.parts[0].position, min, "orange");
        })();
    }

            //const mission = new Mission(
            //    character, pickup, pickupDock, destination, destinationDock, time
            //);
    /*constructor(character, pickup, pickupDock, destination, destinationDock, time) {
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
    }*/

    /**
     * @param {number} t
     */
    tick(t, game) {
        //if (this.time !== null) {
        //    this.time -= t;
        //    if (this.time <= 0) {
        //        // animate(this.game.querySelector(".credits"), "fade-in");
        //        (async() => {
        //            const credits = game.querySelector(".credits");
        //            //this.game.classList.add("game-over");
        //            //await new Promise(resolve => credits.addEventListener("transitionend", resolve, {once: true}));
        //            credits.querySelector("span").textContent = game.level === 1 ?
        //                `The fleet operated for 1 mission.`:
        //                `The fleet operated for ${game.level} missions.`;
        //            credits.querySelector("small").textContent = CONCLUSIONS[this.character.role];
        //            game.classList.add("credits-rolling");
        //            animate2(credits, "credits-fade-in");
        //            await animate2(game.querySelector(".credits > div"), "credits-roll");
        //            game.classList.add("game-over");
        //            game.classList.add("opening");
        //            game.classList.remove("credits-rolling");
        //            // await transition(this.game, "game-over");
        //            game.pause();
        //            game.init();
        //        })();
        //        // game.shuttle.assignMission(null);
        //        this.dispatchEvent(new MissionEvent("missionend", {mission: this}));
        //    }
        //}

        //game.shuttle.updateTarget();

        //switch (this.target.id) {
        //case "pickup":
        //    if (game.shuttle.cargo) {
        //        this.target = new Target("destination", this.destination, this.destination.findNearestDock());
        //        this.poi = new POI(this.destinationDock.parts[0], POIS[this.character.role]);
        //        game.shuttle.updateTarget();
        //        game.shuttle.message(this.character.name, "Good to see you!");
        //    }
        //    break;
        //case "destination":
        //    if (!game.shuttle.cargo) {
        //        // game.shuttle.assignMission(null);
        //        this.dispatchEvent(new MissionEvent("missionend", {mission: this}));
        //        if (this.pickup) {
        //            game.shuttle.message(
        //                game.characters[game.characters.length - 1].name,
        //                `${this.character.name} has arrived. Good job!`
        //            );
        //        } else {
        //            game.shuttle.message("Review", `${4 + Math.trunc(Math.random() * 2)} / 5 *`);
        //        }
        //    }
        //    break;
        //default:
        //    throw new Error();
        //}
    }
}

/** TODO. */
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
