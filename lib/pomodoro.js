'use strict'

const config = require('../config')

class Pomodoro {

    constructor(store, writer, player, cb) {
        this.store = store
        this.writer = writer
        this.player = player
        this.init(cb)
    }

    init(cb) {
        this.store.getPeriods().then((periods) => {
            this.periods = periods
            this.sessions = this.generate() // create iterator
            this.write() // write initial state
            return cb(null)
        }).catch((err) => cb(err))
    }

    get running() {
        return (this.session === undefined ||
                this.session._onTimeout === null) ?
            false : true
    }

    toggle() {
        this.running ? this.pause(): this.resume()
    }

    next() {
        if (this.running) clearInterval(this.session)
        delete this.remaining

        this.store.reschedule((err) => {
            if (err) console.error(err)

            this.store.getPeriods().then((periods) => {
                this.periods = periods

                this.session = this.sessions.next().value
            })
        })
    }

    pause() {
        if (this.running) clearInterval(this.session)

        let period = this.periods[0]

        period.remaining = this.remaining || period.remaining

        this.store.setPeriod(0, period, (err) => {
            if (err) console.error(err)
            this.write()
        })
    }

    resume() {
        this.session = this.sessions.next().value
    }

    clear() {
        if (this.running) clearInterval(this.session)
        delete this.remaining

        this.store.clearPeriods((err) => {
            this.init()
        })
    }

    toString() {
        let output = '',
            blocks = ['◽', '◾'],
            full = Math.floor(this.periods[0]._id / 2),
            empty = 4 - full

        for (let i = 0; i < empty; i++) {
            output += blocks[0]
        }

        for (let i = 0; i < full; i++) {
            output += blocks[1]
        }

        output += '  '
        output += (this.remaining && this.formatTime(this.remaining)) || '00:00'
        output += '\n\n'

        if (this.running) {
            if ((this.periods[0]._id % 2) === 0) {
                output += config.colors.break+'\n'
            } else {
                output += config.colors.session + '\n'
            }
        } else {
            output += config.colors.inactive + '\n'
        }

        return output
    }

    * generate() {
        while (true) {
            let period = this.periods[0],
                startTime = Date.now(),
                interval = setInterval(() => {
                    let now = Date.now()

                    this.remaining = startTime + period.remaining - now

                    this.write()

                    if (now >= startTime + period.remaining) {
                        this.player.play(config.sounds.finish, function(err) {
                            if (err) console.error(err)

                            console.log(`pomodoro is complete`)
                        })

                        this.next()
                    }
                }, 1000)
            yield interval
        }
    }

    write() {
        this.writer.write(new Buffer(this.toString()))
    }

    formatTime(msec) {
        let sec_num = parseInt((msec / 1000), 10),
            minutes = Math.floor(sec_num / 60),
            seconds = sec_num - (minutes * 60)

        if (minutes < 10) minutes = `0${minutes}`

        if (seconds < 10) seconds = `0${seconds}`

        return `${minutes}:${seconds}`
    }
}

module.exports = Pomodoro
