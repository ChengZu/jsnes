
var NES = function(opts) {
  this.opts = {
    onFrame: function() {},
    onAudioSample: null,
    onStatusUpdate: function() {},
    onBatteryRamWrite: function() {},

    // FIXME: not actually used except for in PAPU
    preferredFrameRate: 60,

    emulateSound: true,
    sampleRate: 44100 // Sound sample rate in hz
  };
  if (typeof opts !== "undefined") {
    var key;
    for (key in this.opts) {
      if (typeof opts[key] !== "undefined") {
        this.opts[key] = opts[key];
      }
    }
  }

  this.frameTime = 1000 / this.opts.preferredFrameRate;

  this.ui = {
    writeFrame: this.opts.onFrame,
    updateStatus: this.opts.onStatusUpdate
  };
  this.cpu = new CPU(this);
  this.ppu = new PPU(this);
  this.papu = new PAPU(this);
  this.mmap = null; // set in loadROM()
  this.controllers = {
    1: new Controller(),
    2: new Controller()
  };

  this.ui.updateStatus("Ready to load a ROM.");

  this.frame = this.frame.bind(this);
  this.buttonDown = this.buttonDown.bind(this);
  this.buttonUp = this.buttonUp.bind(this);
  this.zapperMove = this.zapperMove.bind(this);
  this.zapperFireDown = this.zapperFireDown.bind(this);
  this.zapperFireUp = this.zapperFireUp.bind(this);
};

NES.prototype = {
  fpsFrameCount: 0,
  romData: null,

  // Resets the system
  reset: function() {
    if (this.mmap !== null) {
      this.mmap.reset();
    }

    this.cpu.reset();
    this.ppu.reset();
    this.papu.reset();

    this.lastFpsTime = null;
    this.fpsFrameCount = 0;
  },

  frame: function() {
    this.ppu.startFrame();
    var ppuCycles = 0;
    var papuclockFrameCounter =0;
    var emulateSound = this.opts.emulateSound;
    var cpu = this.cpu;
    var ppu = this.ppu;
    var papu = this.papu;
    FRAMELOOP: for (;;) {
      //if (cpu.cyclesToHalt === 0) {
        // Execute a CPU instruction
        cycles = cpu.emulate();
        ppuCycles = cycles * 3;
        papuclockFrameCounter = cycles;
		/*
      } else {
        // make ppu run less code in loop, then we can true one frame has render in time
        if (cpu.cyclesToHalt > 8) {
          ppuCycles = 8 * 3;
          papuclockFrameCounter = 8;
          cpu.cyclesToHalt -= 8;
        } else {
          ppuCycles = cpu.cyclesToHalt * 3;
          papuclockFrameCounter = cpu.cyclesToHalt;
          cpu.cyclesToHalt = 0;
        }
      }*/
	  
      if (emulateSound) papu.clockFrameCounter(papuclockFrameCounter);
	  
      if (ppu.emulateCycles(ppuCycles)) break FRAMELOOP;
	  
    }
    this.fpsFrameCount++;
  },

  buttonDown: function(controller, button) {
    this.controllers[controller].buttonDown(button);
  },

  buttonUp: function(controller, button) {
    this.controllers[controller].buttonUp(button);
  },

  zapperMove: function(x, y) {
    if (!this.mmap) return;
    this.mmap.zapperX = x;
    this.mmap.zapperY = y;
  },

  zapperFireDown: function() {
    if (!this.mmap) return;
    this.mmap.zapperFired = true;
  },

  zapperFireUp: function() {
    if (!this.mmap) return;
    this.mmap.zapperFired = false;
  },

  getFPS: function() {
    var now = +new Date();
    var fps = null;
    if (this.lastFpsTime) {
      fps = this.fpsFrameCount / ((now - this.lastFpsTime) / 1000);
    }
    this.fpsFrameCount = 0;
    this.lastFpsTime = now;
    return fps;
  },

  reloadROM: function() {
    if (this.romData !== null) {
      this.loadROM(this.romData);
    }
  },

  // Loads a ROM file into the CPU and PPU.
  // The ROM file is validated first.
  loadROM: function(data) {
    // Load ROM file:
    this.rom = new ROM(this);
    this.rom.load(data);

    this.reset();
    this.mmap = this.rom.createMapper();
    this.mmap.loadROM();
    this.ppu.setMirroring(this.rom.getMirroringType());
    this.romData = data;
  },

  setFramerate: function(rate) {
    this.opts.preferredFrameRate = rate;
    this.frameTime = 1000 / rate;
    this.papu.setSampleRate(this.opts.sampleRate, false);
  },

  toJSON: function() {
    return {
      romData: this.romData,
      cpu: this.cpu.toJSON(),
      mmap: this.mmap.toJSON(),
      ppu: this.ppu.toJSON()
    };
  },

  fromJSON: function(s) {
    this.loadROM(s.romData);
    this.cpu.fromJSON(s.cpu);
    this.mmap.fromJSON(s.mmap);
    this.ppu.fromJSON(s.ppu);
  }
};

