export class Box {
    static contains(box, p) {
        return p.x >= box.x && p.x < box.x + box.width && p.y >= box.y && p.y < box.y + box.height;
    }

    static grow(box, size) {
        return new DOMRect(box.x - size, box.y - size, box.width + 2 * size, box.height + 2 * size);
    }
}

export async function transition(node, name) {
    node.classList.add(name);
    await new Promise(resolve => node.addEventListener("transitionend", resolve, {once: true}));
}

export async function animate(node, name) {
    await transition(node, name);
    node.classList.remove(name);
}

export async function animate2(node, name) {
    node.style.animationName = name;
    await new Promise(resolve => node.addEventListener("animationend", resolve, {once: true}));
    node.style.animationName = "";
}
