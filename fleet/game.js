// TODO license

// TODO many exports not needed at all

import {SHIP_NAMES, SURNAMES} from "./names.js";
import {Body} from "./simulation.js";
import {Polygon, Roulette, Vector, createSVGElement, distribute, shuffle, sum} from "./util.js";

/** Space ship. */
export class Ship {
    static MODULE_WIDTH = 40;
    static MODULE_HEIGHT = 20;
    static BLEED = 0.1;
    static UNIT = 4;

    /**
     * @param {string} name - Name of the ship.
     * @param {string} color - Primary color.
     */
    constructor(name, color) {
        this.name = name;
        this.color = color;
        /**
         * Module grid.
         * @type {Module[][]}
         */
        this.modules = [];
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

    /**
     * Move the ship.
     *
     * @param {DOMPoint} displacement - Movement vector.
     */
    move(displacement) {
        for (let row of this.modules) {
            for (let module of row) {
                module.move(displacement);
            }
        }
    }
        // DELETE
        //const width = this.modules[0].length * Ship.MODULE_WIDTH;
        //const height = this.modules.length * Ship.MODULE_HEIGHT;
        //for (let y = 0; y < this.modules.length; y++) {
        //    for (let x = 0; x < this.modules[0].length; x++) {
        //        this.modules[y][x].place(
        //            new DOMPoint(
        //                x * Ship.MODULE_WIDTH - width / 2 + Ship.MODULE_WIDTH / 2 + position.x,
        //                y * -Ship.MODULE_HEIGHT + height / 2 - Ship.MODULE_HEIGHT / 2 + position.y
        //            )
        //        );
        //    }
        //}

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

/** Ship module. */
export class Module {
    /**
     * @param {string} type - Type of the module.
     * @param {Body[]} parts - Parts the module is composed of.
     * @param {Ship} ship - Related ship.
     */
    constructor(type, parts, ship) {
        this.type = type;
        this.parts = parts;
        this.ship = ship;
    }

    get name() {
        return `the ${this.type} on the ${this.ship.name}`;
    }

    /**
     * Move the module.
     *
     * @param {DOMPoint} displacement - Movement vector.
     */
    move(displacement) {
        for (let part of this.parts) {
            part.update(Vector.add(part.position, displacement), 0);
        }
    }

    /**
     * TODO.
     * @return {Dock}
     */
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

/** Ship dock. */
export class Dock extends Module {
    /**
     * @param {string} id - TODO.
     * @param {Body[]} parts
     * @param {Polygon} zone - TODO.
     * @param {Ship} ship
     */
    constructor(id, parts, zone, ship) {
        super("dock", parts, ship);
        this.id = id;
        this.zone = zone;
        /** TODO. */
        this.state = "arrival";
        /** TODO. */
        this.cargo = null;
    }

    /** @param {DOMPoint} displacement */
    move(displacement) {
        super.move(displacement);
        this.zone = this.zone.transform(
            new DOMMatrix().translateSelf(displacement.x, displacement.y)
        );
    }

    get name() {
        return `dock ${this.id} on the ${this.ship.name}`;
    }

    /**
     * TODO.
     *
     * @param {?Cargo} cargo - TODO.
     * @return {?Cargo}
     */
    dock(cargo = null) {
        if (cargo) {
            return null;
        }
        const result = this.cargo;
        this.cargo = null;
        return result;
    }

    tick(game) {
        if (!this.cargo) {
            let load = new Character(
                "Crewmember", SURNAMES[Math.trunc(Math.random() * SURNAMES.length)]
            );
            let destination = null;
            let dock = this;
            while (dock === this) {
                destination = game.getRandomLocation();
                dock = destination.findNearestDock();
            }
            this.cargo = new Cargo(load, destination, dock, {
                pickUpMessage: {from: load.name, text: `Hi! To ${destination.name}, please!`},
                dropOffMessage: {from: "Review", text: `${4 + Math.trunc(Math.random() * 2)} / 5 *`}
            });
        }

        // TODO not every frame
        // const hot = this.#hot.transform(this.parts[0].matrix);
        const hot = this.zone;
        switch (this.state) {
        case "arrival":
            break;
            if (
                // (!game.shuttle.cargo || game.shuttle.cargo.dock === this) &&
                // (!game.shuttle.mission || game.shuttle.mission.target.dock === this) &&

                // (!game.shuttle.mission || game.shuttle.mission.dock === this) &&

                (!game.shuttle.cargo || game.shuttle.cargo.dock === this) &&
                game.shuttle.joints.size >= 2 &&
                [...game.shuttle.joints].every(
                    link => hot.contains(link.bodyA.matrix.transformPoint(link.anchorA))
                )
            ) {
                // let mission;

                // if (game.shuttle.cargo?.dock === this) {
                //if (game.shuttle.mission.target.dock === this) {

                //let cargo;
                //if (game.shuttle.mission) {
                //    cargo = game.shuttle.mission.target.id === "pickup"
                //        ? game.shuttle.mission.character : null;
                //} else {
                //    cargo = new Character(
                //        "Crewmember", SURNAMES[Math.trunc(Math.random() * SURNAMES.length)]
                //    );
                //}


                //game.querySelector(".cargo").textContent =
                //    cargo.destination.type === "dock" ?
                //    `Passenger to ${cargo.ship.name}, dock ${cargo.dock.id}` :
                //    `Passenger to ${cargo.destination.type} on ${cargo.ship.name}, dock ${cargo.dock.id}`;

                this.state = "docking";
                (async () => {
                    //await game.shuttle.dock(cargo);
                    //this.state = "departure";

                    if (game.shuttle.cargo) {
                        await game.shuttle.dock();
                    } else {
                        await game.shuttle.dock(this.cargo);
                        this.cargo = null;
                    }
                    this.state = "departure";

                    //if (!game.shuttle.mission) {
                    //    // const ship = game.fleet[Math.trunc(Math.random() * game.fleet.length)];
                    //    //const x = Math.trunc(Math.random() * ship.modules[0].length);
                    //    //const y = Math.trunc(Math.random() * ship.modules.length);
                    //    // const modules = ship.modules.flat();
                    //    // const modules = game.fleet.map(ship => ship.modules).flat(2);
                    //    let module = null;
                    //    let dock = this;
                    //    while (dock === this) {
                    //        console.log("FIND DOCK");
                    //        // module = modules[Math.trunc(Math.random() * modules.length)];
                    //        module = game.getRandomLocation();
                    //        dock = module.findNearestDock();
                    //    }

                    //    await game.shuttle.message(
                    //        cargo.name,
                    //        // `Hi! To the ${cargo.destination.type} on the ${cargo.destination.ship.name}, please!`
                    //        `Hi! To ${module.name}, please!`
                    //    );

                    //    //const name = SURNAMES[Math.trunc(Math.random() * SURNAMES.length)];
                    //    //cargo = new Cargo(name, module, dock);
                    //    mission = new Mission(cargo, null, null, module, dock);
                    //    game.shuttle.assignMission(mission);
                    //}
                })();
            }
            break;

        case "docking":
            break;

        case "departure":
            if (game.shuttle.joints.size === 0) {
                this.state = "arrival";
            }
            break;

        default:
            throw new Error();
        }
    }
}

/**
 * Message.
 *
 * @typedef {Object} Message
 * @property {string} text - Bla bla.
 * @property {string} from - Person or something.
 */

/** Shuttle cargo. */
export class Cargo {
    /**
     * @param {Character} load - Transported passenger or good.
     * @param {Module} destination - Destination of the cargo.
     * @param {Dock} dock - Destination dock.
     * @param {Object} options - Optional arguments.
     * @param {?string} [options.label] - TODO.
     * @param {?Message} [options.pickUpMessage] - TODO.
     * @param {?Message} [options.dropOffMessage] - TODO.
     */
    constructor(
        load, destination, dock, {label = null, pickUpMessage = null, dropOffMessage = null} = {}
    ) {
        this.load = load;
        this.destination = destination;
        this.dock = dock;
        this.label = label;
        this.pickUpMessage = pickUpMessage;
        this.dropOffMessage = dropOffMessage;
    }
}

/** Character. */
export class Character {
    /**
     * @param {string} role - Fleet position.
     * @param {string} surname - Family name.
     */
    constructor(role, surname) {
        this.role = role;
        this.surname = surname;
    }

    get name() {
        return `${this.role[0].toUpperCase()}${this.role.slice(1)} ${this.surname}`;
    }
}

/** Docking event. */
export class DockingEvent extends Event {
    /**
     * @param {"dock"} type
     * @param {Object} init - Event arguments.
     * @param {Dock} init.dock - TODO.
     * @param {?Cargo} init.incoming - TODO.
     * @param {?Cargo} init.outgoing - TODO.
     */
    constructor(type, {dock, incoming, outgoing, ...init}) {
        super(type, init);
        this.dock = dock;
        this.incoming = incoming;
        this.outgoing = outgoing;
    }
}

/** TODO */
export class FleetGenerator {
    /** TODO. */
    generate() {
        // max capacity of ship (8 blocks local)
        const CAPACITY = 32 - 8;
        // max capacity of small ship (3 blocks local)
        const BLOCKS = CAPACITY + (8 - 3);

        let ships = [...new Array(2)].map(() => []);
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
            ship.move(new DOMPoint(pos, 0));
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

        const step = blueprint.length + 2 > 8 ? 2 : 1;
        blueprint.unshift(...new Array(step).fill("engineBow"));
        blueprint.push(...new Array(step).fill("engineStern"));

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
                module.move(
                    new DOMPoint(
                        x * Ship.MODULE_WIDTH - width / 2 + Ship.MODULE_WIDTH / 2,
                        y * -Ship.MODULE_HEIGHT + height / 2 - Ship.MODULE_HEIGHT / 2
                    )
                );
                //for (let part of module.parts) {
                //    const pos = new DOMPoint(
                //        // x * Ship.MODULE_WIDTH - width / 2, y * Ship.MODULE_HEIGHT - height / 2
                //        x * Ship.MODULE_WIDTH - width / 2 + Ship.MODULE_WIDTH / 2,
                //        height / 2 - y * Ship.MODULE_HEIGHT - Ship.MODULE_HEIGHT / 2
                //    );
                //    part.update(Vector.add(part.position, pos), 0);
                //}
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
        const g = createSVGElement("g", {class: "ship-quarters"});

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
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
                //    createSVGElement("rect", {class: `ship-window ${on}`, width: 0.75, height: 2, x: left + 4 * x + 1, y: bottom + 4 * y + 1}),
                //    createSVGElement("rect", {class: `ship-window ${on}`, width: 0.75, height: 2, x: left + 4 * x + 2.25, y: bottom + 4 * y + 1})
                //);
                //g.append(
                //    createSVGElement("rect", {class: `ship-window ${on}`, width: 1, height: 2, x: left + 4 * x + 1, y: bottom + 4 * y + 1, rx: 0.5, ry: 0.5}),
                //    createSVGElement("rect", {class: `ship-window ${on}`, width: 1, height: 2, x: left + 4 * x + 2.5, y: bottom + 4 * y + 1, rx: 0.5, ry: 0.5})
                //);
                //g.append(
                //    createSVGElement("rect", {class: `ship-window ${on}`, width: 2, height: 1, x: left + 4 * x + 1, y: bottom + 4 * y + 1.5, rx: 0.25, ry: 0.25})
                //);
                g.append(
                    createSVGElement("rect", {class: `ship-window ${on}`, width: 2, height: 1.5, x: left + 4 * x + 1, y: bottom + 4 * y + 1, rx: 0.25, ry: 0.25})
                );
                //g.append(
                //    createSVGElement("rect", {class: `ship-window ${on}`, width: 1, height: 2, x: left + 2 * x + 1, y: bottom + 4 * y + 1, rx: 0.5, ry: 0.5})
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

        const entity = new Body(Polygon.fromRect(left, bottom, width, height), Infinity, g);
        //entity.update(new DOMPoint(100, 100), 0);
        //entity.position = new Vector(-left, 0);
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
        const g = createSVGElement("g", {class: "ship-dock"});
        const rect = createSVGElement("rect", {fill: "#ccc", x: -width / 2, y: -height / 2, width, height});
        let lock;
        const text = createSVGElement("text", {fill: ship.color});
        const id = String.fromCharCode(
            "A".charCodeAt(0) + ship.modules.flat().filter(module => module.type === "dock").length
        );
        // const id = ["A", "B", "C", "D"][Math.trunc(Math.random() * 4)];
        text.textContent = id;
        let hot;
        let portholes;
        if (port) {
            hot = Polygon.fromRect(left - 1, bottom + 5.5, 1, 5);
            lock = createSVGElement(
                "rect",
                {fill: "url(#lock-gradient-v)", x: left - 1, y: bottom + 5.5, width: 1, height: 5}
            );
            text.style.transform = `translate(${left + 1}px, ${bottom + 8}px) rotate(-90deg) scaleY(-1)`;
            portholes = this.#generatePortholes(new DOMPoint(left + 8, bottom + 4), 2, 2);
        } else {
            hot = Polygon.fromRect(left + width, bottom + 5.5, 1, 5);
            lock = createSVGElement(
                "rect",
                {fill: "url(#lock-gradient-v)", x: left + width, y: bottom + 5.5, width: 1, height: 5}
            );
            text.style.transform = `translate(${left + width - 1}px, ${bottom + 8}px) rotate(90deg) scaleY(-1)`;
            portholes = this.#generatePortholes(new DOMPoint(left + width - 16, bottom + 4), 2, 2);
        }
        g.append(rect, lock, text, portholes);
        return new Dock(
            id, [new Body(Polygon.fromRect(-width / 2, -height / 2, width, height), Infinity, g)],
            hot, ship
        );
    }

    #generateEngineBow(port, starboard, context) {
        console.log("PORT", port, starboard);
        const width = Ship.MODULE_WIDTH + 2 * Ship.BLEED;
        const height = 16 + 2 * Ship.BLEED;
        const l = -Ship.MODULE_WIDTH / 2 - Ship.BLEED;
        const b = -Ship.MODULE_HEIGHT / 2 - Ship.BLEED;
        const leftCorner = port
            ? `L ${l} ${b + height - 1} A 1 1 0 0 0 ${l + 1} ${b + height}` : `L ${l} ${b + height}`;
        const rightCorner = starboard
            ? `L ${l + width - 1} ${b + height} A 1 1 0 0 0 ${l + width} ${b + height - 1}`
            : `L ${l + width} ${b + height}`;
        const g = createSVGElement("g", {class: "ship-bow"});
        g.append(
            createSVGElement(
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
            createSVGElement(
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
        /*text = createSVGElement("text", {x: l + 20, y: -(b + 1 + 2), fill: ship.color});
        text.textContent = "AQUARIUS";
        g.append(text);*/
                //this.#generatePortholes(new DOMPoint(l, b + 4), 2, 1, {light: 1}),
                //this.#generatePortholes(new DOMPoint(l + 12, b + 4), 1, 1, {width: 14, light: 1}),
                //this.#generatePortholes(new DOMPoint(l + width - 8, b + 4), 2, 1, {light: 1})

        if (starboard) {
            const y = port ? -(b + 1) : -(b + 4 + 1);
            let text = createSVGElement("text", {x: l + 20, y, fill: context.color});
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
            "bridge", [new Body(Polygon.fromRect(l, b, width, height), Infinity, g)], context
        );
    }

    #generateEngineStern(port, starboard, ship) {
        // TODO: gradient
        // TODO: slimmer design
        const parts = [];
        //function generateThruster() {
        //    return new Body(
        //        Polygon.fromRect(-4, -10, 8, 20), Infinity,
        //        createSVGElement(
        //            "path",
        //            // {class: "ship-engine-bow", d: "M -4 -10 L -4 8 A 4 2 0 0 0 4 8 L 4 -10 Z"}
        //            {class: "ship-engine-bow", d: "M -10 -10 L -10 8 A 4 2 0 0 0 -6 10 L 6 10 A 4 2 0 0 0 10 8 L 10 -10 Z"}
        //        )
        //    );
        //}

        const thruster = createSVGElement("rect", {x: -10, y: -10, width: 20, height: 4, fill: "url(#thruster-gradient)"});
        parts.push(new Body(Polygon.fromRect(-10, -10, 20, 4), Infinity, thruster));

        const w = Ship.MODULE_WIDTH + 2 * Ship.BLEED;
        const h = 4 * Ship.UNIT + 2 * Ship.BLEED;
        const l = -w / 2;
        const b = -1.5 * Ship.UNIT - Ship.BLEED;
        const leftCorner = port
            ? `L ${l + 1} ${b} A 1 1 0 0 0 ${l} ${b + 1}` : `L ${l} ${b}`;
        const rightCorner = starboard
            ? `L ${l + w} ${b + 1} A 1 1 0 0 0 ${l + w - 1} ${b}` : `L ${l + w} ${b}`;
        const path = createSVGElement(
            "path",
            {
                class: "ship-engine-bow",
                d: `M ${l} ${b + h} L ${l + w} ${b + h} ${rightCorner} ${leftCorner} Z`
            }
        );

        //const rect = createSVGElement(
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
        parts.push(new Body(Polygon.fromRect(-20, -6, 40, 16), Infinity, path));
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
                    createSVGElement(
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
