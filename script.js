const Constants = {
    HORIZONTAL: 0,
    VERTICAL: 1,
};

HTMLElement.prototype.addClass = function (name) {
    let names = name.split(' ');
    for (let n of names) {
        if (this.className === '') {
            this.className = n;
        } else if (!this.classList.contains(n)) {
            this.className = this.className.split(' ').concat(names).map(x => x.trim()).join(' ');
        }
    }

    return this;
}

HTMLElement.prototype.removeClass = function (name) {
    let names = name.split(' ').map(x => x.trim());
    let classNames = this.className.split(' ');
    for (let n of names) {
        let i = classNames.indexOf(n);
        if (i >= 0) {
            classNames.splice(i, 1);
        }
    }
    this.className = classNames.join(' ');

    return this;
}

class CanvasObject {

    constructor() {
        objects.push(this);
        this.domNode = document.createElement('div').addClass('canvas-object');

        canvas.append(this.domNode);

        this.setSelected(false);

        this.moved = false;
        this.isMoving = true;
        this.startPosition = null;
    }

    setSelected(selected) {
        this.selected = selected;

        if (this.selected) {
            this.domNode.addClass('selected');
        } else {
            this.domNode.removeClass('selected');
        }
    }

    onMouseDown(e) {
        if (e.target !== this.domNode) {
            if (this.selected)
                this.isMoving = true;
            return false;
        }

        if (!e.ctrlKey) {
            for (let o of objects)
                o.setSelected(false);
        }

        this.setSelected(true);
        this.moved = false;
        this.isMoving = true;

        return true;
    }

    onMouseUp(e) {
        if (this.moved) {
            this.setSelected(this.selected);
        }

        this.isMoving = false;

        return true;
    }

    onMouseMove() {
        if (this.selected)
            this.moved = true;
    }

    onKeyDown(e) {
        if (!this.selected)
            return;

        switch (e.keyCode) {
            case 8: // Backspace
            case 46: // Delete
                let i = objects.indexOf(this);
                if (i >= 0) {
                    objects.splice(i, 1);
                }
                this.domNode.parentNode.removeChild(this.domNode);
                delete this;
        }
    }

}

class StickyLine extends CanvasObject {

    constructor(direction, position) {
        super();
        this.domNode.addClass('sticky-line');
        this.direction = direction;

        if (this.direction === Constants.HORIZONTAL) {
            this.domNode.addClass('horizontal');
        } else {
            this.domNode.addClass('vertical');
        }

        this.setPosition(position);
        this.startPosition = this.position;
        this.setSpread(false);

        this.dependencies = [];
    }

    setPosition(position) {
        if (this.direction === Constants.HORIZONTAL) {
            this.domNode.style.top = position + 'px';
        } else {
            this.domNode.style.left = position + 'px';
        }

        this.position = position;
    }

    setSpread(spread) {
        this.spread = spread;
        if (this.spread) {
            this.domNode.addClass('spread');
        } else {
            this.domNode.removeClass('spread');
        }
    }

    switchDirection() {
        if (this.direction === Constants.HORIZONTAL) {
            this.domNode.style.top = null;
            this.direction = Constants.VERTICAL;
            this.domNode.removeClass('horizontal').addClass('vertical');
        } else {
            this.domNode.style.left = null;
            this.domNode.removeClass('vertical').addClass('horizontal');
            this.direction = Constants.HORIZONTAL;
        }
        this.setPosition(this.position);
    }

    reorder() {
        let otherLines = this.getOtherLines();
        for (let d of this.dependencies) {
            for (let o of otherLines) {
                let i = o.dependencies.indexOf(d);
                if (i >= 0) {
                    o.dependencies.splice(i, 1);
                }
            }
        }
        if (this.direction === Constants.HORIZONTAL) {
            this.dependencies.sort((a, b) => a.position.x - b.position.x);
            let dependenciesLength = this.dependencies.reduce((a, b) => a + b.width + 8, 0);
            let length = parseInt(getComputedStyle(this.domNode)["width"]) - dependenciesLength;
            let gap = length / (this.dependencies.length + 1);
            let distance = 0;
            for (let d of this.dependencies) {
                distance += gap + (d.height + 8) / 2;
                d.position.x = distance;
                d.updatePosition();
                distance += (d.height + 8) / 2;
            }
        } else {
            this.dependencies.sort((a, b) => a.position.y - b.position.y);
            let dependenciesLength = this.dependencies.reduce((a, b) => a + b.height + 8, 0);
            let length = parseInt(getComputedStyle(this.domNode)["height"]) - dependenciesLength;
            let gap = length / (this.dependencies.length + 1);
            let distance = 0;
            for (let d of this.dependencies) {
                distance += gap + (d.width + 8) / 2;
                d.position.y = distance;
                d.updatePosition();
                distance += (d.width + 8) / 2;
            }
        }
    }

    getOtherLines() {
        let others = [];
        for (let o of objects) {
            if (o instanceof StickyLine && o !== this)
                others.push(o);
        }
        return others;
    }

    addDependance(o) {
        if (!this.dependencies.includes(o))
            this.dependencies.push(o);

        if (this.direction === Constants.HORIZONTAL) {
            o.position.y = this.position;
        } else {
            o.position.x = this.position;
        }
        o.updatePosition();
        if (this.spread)
            this.reorder();
    }

    removeDependance(o) {
        let i = this.dependencies.indexOf(o);
        if (i >= 0) {
            this.dependencies.splice(i, 1);
        }
        if (this.spread)
            this.reorder();
    }

    onMouseDown(e) {
        this.startPosition = this.position;

        super.onMouseDown(e);
    }

    onMouseMove(e) {
        super.onMouseMove();

        if (!this.selected || !this.isMoving)
            return false;

        if (this.direction === Constants.HORIZONTAL) {
            this.setPosition(this.startPosition + e.clientY - mousePositionStart.y);
        } else {
            this.setPosition(this.startPosition + e.clientX - mousePositionStart.x);
        }

        for (let o of this.dependencies) {
            if (this.direction === Constants.HORIZONTAL) {
                o.position.y = this.position;
            } else {
                o.position.x = this.position;
            }
            o.updatePosition();
        }

        return true;
    }

}

class ShapeObject extends CanvasObject {

    constructor(x, y, w, h) {
        super();

        this.setPosition(x, y);
        this.setWidth(w);
        this.setHeight(h);

        this.startPosition = Object.assign({}, this.position);
    }

    setPosition(x, y) {
        this.position = {
            x,
            y
        };
        this.updatePosition();
    }

    updatePosition() {
        this.domNode.style.left = this.position.x - (this.width + 8) / 2 + 'px';
        this.domNode.style.top = this.position.y - (this.height + 8) / 2 + 'px';
    }

    setDimensions(w, h) {
        this.setWidth(w);
        this.setHeight(h);
    }

    setWidth(w) {
        this.width = w;
        this.domNode.style.width = w + 'px';
        this.updatePosition();
    }

    setHeight(h) {
        this.height = h;
        this.domNode.style.height = h + 'px';
        this.updatePosition();
    }

    onMouseDown(e) {
        this.startPosition = Object.assign({}, this.position);

        super.onMouseDown(e);
    }

    onMouseMove(e) {
        super.onMouseMove();

        if (!this.selected || !this.isMoving)
            return false;

        let x = this.startPosition.x + e.clientX - mousePositionStart.x;
        let y = this.startPosition.y + e.clientY - mousePositionStart.y;
        this.setPosition(x, y);

        for (let o of objects) {
            if (!(o instanceof StickyLine))
                continue;
            if (this.isCloseOf(o)) {
                this.stickTo(o);
            } else {
                this.unstickFrom(o);
            }
        }

        return true;
    }

    isCloseOf(o) {
        let distance;
        if (o.direction === Constants.HORIZONTAL) {
            distance = o.position - this.position.y;
        } else {
            distance = o.position - this.position.x;
        }
        return Math.abs(distance) < 15;
    }

    stickTo(o) {
        o.addDependance(this);
    }

    unstickFrom(o) {
        o.removeDependance(this);
    }

}

class Rectangle extends ShapeObject {

    constructor(x, y, w, h) {
        super(x, y, w, h);

        this.domNode.addClass('rectangle');
    }

}

class Ellipse extends ShapeObject {

    constructor(x, y, w, h) {
        super(x, y, w, h);

        this.domNode.addClass('ellipse');
    }

}

function onMouseDown(e) {
    let didSomething = false;
    mousePositionStart = {
        x: e.clientX,
        y: e.clientY
    };

    for (let o of objects) {
        didSomething |= o.onMouseDown(e);
    }

    for (let tool of tools) {
        if ((tool instanceof Tool && tool.selected) || tool instanceof DistributeLine) {
            tool.onMouseDown(e, didSomething);
        }
    }
}

function onMouseUp(e) {
    let didSomething = false;

    for (let o of objects) {
        didSomething |= o.onMouseUp(e);
    }

    for (let tool of tools) {
        if (tool.selected) {
            tool.onMouseUp(e);
        }
    }
}

function onMouseMove(e) {
    let didSomething = false;

    for (let tool of tools) {
        if (tool.selected) {
            didSomething |= tool.onMouseMove(e);
        }
    }

    if (didSomething) {
        previousMousePosition = {
            x: e.clientX,
            y: e.clientY
        };
        return;
    }

    for (let o of objects) {
        didSomething |= o.onMouseMove(e);
    }

    previousMousePosition = {
        x: e.clientX,
        y: e.clientY
    };
}

function onKeyDown(e) {
    for (let i = objects.length - 1; i >= 0; i--) {
        let o = objects[i];
        o.onKeyDown(e);
    }
}

function unselectAll() {
    for (let o of objects) {
        o.setSelected(false);
    }
}

let canvas = document.getElementById('canvas');
let objects = [];
let sl1 = new StickyLine(Constants.HORIZONTAL, 200);
let sl2 = new StickyLine(Constants.VERTICAL, 200);
let c1 = new Ellipse(300, 100, 125, 125);
let c2 = new Ellipse(450, 350, 120, 120);
let r1 = new Rectangle(450, 160, 50, 150);
let r2 = new Rectangle(600, 160, 75, 75);
let tools = [];
let toolbox;
let mousePositionStart = {
    x: -1,
    y: -1
};

document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
});
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mouseup', onMouseUp);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('keydown', onKeyDown);

class Function {

    constructor(name) {
        this.name = name;
        this.domNode = document.createElement('div');
        this.domNode.innerHTML = this.name;
        this.domNode.addClass('tool');
        this.domNode.addEventListener('click', this.onClick.bind(this));
    }

    appendTo(o) {
        o.append(this.domNode);
    }

    onClick() {}
    onMouseMove(e) {
        if (e.target === this.domNode)
            return true;
        return false;
    }

    setSelected(selected) {
        this.selected = selected;

        if (this.selected) {
            this.domNode.addClass('selected');
        } else {
            this.domNode.removeClass('selected');
        }
    }

}

class Command extends Function {

    constructor(name, selected) {
        super(name);
    }

}

class Tool extends Function {

    constructor(name, selected) {
        super(name);

        this.setSelected(selected);
    }

    onClick(e) {
        for (let tool of tools) {
            if (tool instanceof Tool)
                tool.setSelected(false);
        }

        this.setSelected(true);
    }

    onMouseDown() {}
    onMouseUp() {}

}

class VerticalLine extends Tool {

    constructor(selected) {
        super('Vertical Line', selected);
    }

    onMouseDown(e, didSomething) {
        if (didSomething || e.target !== canvas)
            return;

        unselectAll();

        if (e.button !== 0)
            return;

        let sl = new StickyLine(Constants.VERTICAL, e.clientX);
        sl.setSelected(true);
    }

}

class HorizontalLine extends Tool {

    constructor(selected) {
        super('Horizontal Line', selected);
    }

    onMouseDown(e, didSomething) {
        if (didSomething || e.target !== canvas)
            return;

        unselectAll();

        if (e.button !== 0)
            return;

        let sl = new StickyLine(Constants.HORIZONTAL, e.clientY);
        sl.setSelected(true);
    }

}

class ShapeTool extends Tool {

    constructor(name, selected) {
        super(name, selected);

        this.rect = {};
        this.hide();
    }

    hide() {
        this.setPosition(-1, -1);
        this.setDimensions(0, 0);
    }

    setPosition(x, y) {
        this.rect.x = x;
        this.rect.y = y;
        this.updateShapeNode();
    }

    setDimensions(w, h) {
        this.rect.w = w;
        this.rect.h = h;
        this.updateShapeNode();
    }

    updateShapeNode() {
        if (!this.shapeNode)
            return;

        let {
            x,
            y,
            w,
            h
        } = this.getRectangle();
        this.shapeNode.style.left = x + "px";
        this.shapeNode.style.top = y + "px";
        this.shapeNode.style.width = w + "px";
        this.shapeNode.style.height = h + "px";
    }

    getRectangle() {
        let x, y, w, h;
        if (this.rect.w < 0) {
            x = this.rect.x + this.rect.w;
            w = -this.rect.w;
        } else {
            x = this.rect.x;
            w = this.rect.w;
        }
        if (this.rect.h < 0) {
            y = this.rect.y + this.rect.h;
            h = -this.rect.h;
        } else {
            y = this.rect.y;
            h = this.rect.h;
        }
        return {
            x,
            y,
            w,
            h
        };
    }

    includes(o) {
        let {
            x,
            y,
            w,
            h
        } = this.getRectangle();

        return !(o.position.x < x ||
            o.position.x >= x + w ||
            o.position.y < y ||
            o.position.y >= y + h);
    }

}

class Select extends ShapeTool {

    constructor(selected) {
        super('Select', selected);

        this.shapeNode = document.createElement('div').addClass('selection');
        this.selecting = false;
        canvas.append(this.shapeNode);
        this.previouslySelected = [];
    }

    onMouseDown(e, didSomething) {
        if (didSomething || e.target !== canvas)
            return;

        if (e.ctrlKey) {
            this.previouslySelected = [];
            for (let o of objects) {
                if (o instanceof ShapeObject && o.selected) {
                    this.previouslySelected.push(o);
                }
            }
        } else {
            unselectAll();
        }

        if (e.button !== 0)
            return;

        this.setPosition(e.clientX, e.clientY);
        this.setDimensions(0, 0);
        this.selecting = true;
    }

    onMouseMove(e) {
        if (!this.selecting)
            return;

        unselectAll();
        this.setDimensions(e.clientX - this.rect.x, e.clientY - this.rect.y);

        for (let o of this.previouslySelected) {
            o.setSelected(true);
        }
        for (let o of objects) {
            if (o instanceof ShapeObject && this.includes(o)) {
                o.setSelected(true);
            }
        }

        return true;
    }

    onMouseUp(e) {
        this.selecting = false;
        this.hide();
    }

}

class DrawShapeTool extends ShapeTool {

    constructor(name, selected) {
        super(name, selected);

        this.shape = null;
        this.drawing = false;
    }

    updateShapeNode() {
        if (!this.shape)
            return null;

        let {
            x,
            y,
            w,
            h
        } = this.getRectangle();
        this.shape.setPosition(x + (w + 8) / 2, y + (h + 8) / 2);
        this.shape.setDimensions(w, h);
    }

    onMouseDown(e, didSomething) {
        if (didSomething || e.target !== canvas)
            return;

        unselectAll();

        if (e.button !== 0)
            return;

        this.createShape();

        this.setPosition(e.clientX, e.clientY);
        this.setDimensions(0, 0);
        this.drawing = true;
    }

    onMouseMove(e) {
        if (!this.drawing)
            return;

        this.setDimensions(e.clientX - this.rect.x, e.clientY - this.rect.y);

        return true;
    }

    onMouseUp(e) {
        this.drawing = false;
        this.shape = null;
    }

    createShape() {}

}

class DrawRectangle extends DrawShapeTool {
    constructor(selected) {
        super('Rectangle', selected);
    }

    createShape() {
        this.shape = new Rectangle();
    }
}

class DrawEllipse extends DrawShapeTool {
    constructor(selected) {
        super('Ellipse', selected);
    }

    createShape() {
        this.shape = new Ellipse();
    }
}

class VerticalAlignment extends Command {

    constructor() {
        super('Vertical Alignment');
    }

    onClick(e) {
        let meanX = 0;
        let lObjects = [];

        for (let o of objects) {
            if (o instanceof ShapeObject && o.selected) {
                meanX += o.position.x;
                lObjects.push(o);
            }
        }
        meanX /= lObjects.length;
        for (let o of lObjects) {
            o.position.x = meanX;
            o.updatePosition();
        }
    }

}

class HorizontalAlignment extends Command {

    constructor() {
        super('Horizontal Alignment');
    }

    onClick(e) {
        let meanY = 0;
        let lObjects = [];

        for (let o of objects) {
            if (o instanceof ShapeObject && o.selected) {
                meanY += o.position.y;
                lObjects.push(o);
            }
        }
        meanY /= lObjects.length;
        for (let o of lObjects) {
            o.position.y = meanY;
            o.updatePosition();
        }
    }

}

class DistributeLine extends Function {

    constructor() {
        super("Distribute elements");
        
        this.disable();
    }

    onMouseDown(e) {
        this.checkState();
    }

    onMouseUp(e) {
        this.checkState();
    }

    onClick(e) {
        let line = this.getSelectedLine();
        if (line) {
            line.setSpread(!line.spread);
            this.setSelected(line.spread);
            if (line.spread) {
                line.reorder();
            }
        }
    }

    getSelectedLine() {
        let selectedLines = objects.filter(o => o instanceof StickyLine && o.selected);
        if (selectedLines.length !== 1)
            return null;
        return selectedLines[0];
    }

    checkState() {
        let line = this.getSelectedLine();
        if (!line)
            this.disable();
        else {
            this.enable();
            this.setSelected(line.spread);
        }
    }

    disable() {
        this.disabled = true;
        this.domNode.addClass('disable');
    }

    enable() {
        this.disabled = false;
        this.domNode.removeClass('disable');
    }

}

function createToolbox() {
    toolbox = document.createElement('div');
    toolbox.id = 'toolbox';
    document.body.append(toolbox);

    tools.push(new Select(true));
    tools.push(new DrawRectangle());
    tools.push(new DrawEllipse());
    tools.push(new VerticalLine());
    tools.push(new HorizontalLine());
    tools.push(new VerticalAlignment());
    tools.push(new HorizontalAlignment());
    tools.push(new DistributeLine());

    for (let tool of tools) {
        tool.appendTo(toolbox);
    }
}

createToolbox();