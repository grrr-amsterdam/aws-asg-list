#!/usr/bin/env node
/**
 * @author David Spreekmeester <david@grrr.nl>
 */
const config    = require('12g-dynamic-env-vars')
const util      = require('util')
const exec      = util.promisify(require('child_process').exec);

var configKeys = [
    'AUTOSCALE_APP',
    'AUTOSCALE_REGION',
    'AUTOSCALE_KEY',
    'AUTOSCALE_SECRET'
];

run()

async function run () {
    try {
        const configVars = await config.load(configKeys)
        setCreds(configVars)
        const autoScalingGroups = await descAutoScalingGroups(configVars)
        const allInstances = await descInstances(configVars)
        const filteredInstances = filterInstances(allInstances, autoScalingGroups)

        console.log(filteredInstances.join("\n"))
    } catch (err) {
        console.error(err)
    }
}

function setCreds(configVars) {
    process.env.AWS_ACCESS_KEY_ID = configVars.AUTOSCALE_KEY
    process.env.AWS_SECRET_ACCESS_KEY = configVars.AUTOSCALE_SECRET
}

async function descInstances(configVars) {
    var cmd = 'aws ec2 describe-instances '
        + '--region ' + configVars.AUTOSCALE_REGION + ' ' 
        + '--query \'Reservations[*].Instances[*].{x:InstanceId,y:PublicIpAddress}\' '
        + '--output text'
    const { stdout, stderr } = await exec(cmd)
    return stdout
}

async function descAutoScalingGroups(configVars) {
    var cmd = 'aws autoscaling describe-auto-scaling-groups '
        + '--auto-scaling-group-name ' + configVars.AUTOSCALE_APP + ' '
        + '--region ' + configVars.AUTOSCALE_REGION + ' '
        + '--query \'AutoScalingGroups[*].Instances\' '
        + '--output text |grep Healthy |grep InService | awk {\'print $3\'}|sort -V'
    const { stdout, stderr } = await exec(cmd)
    return stdout
}

function filterInstances(allInstancesLines, autoScalingGroupsLines) {
    var allInstances = allInstancesLines.split("\n")
    var autoScalingGroups = autoScalingGroupsLines.split("\n")
    var filteredInstances = []

    allInstances.filter(function (instance) {
        for (var asg in autoScalingGroups) {
            if (
                instance.indexOf(autoScalingGroups[asg]) === 0 &&
                autoScalingGroups[asg] !== '' &&
                instance !== ''
            ) {
                var filteredAddress = instance.substring(instance.indexOf("\t") + 1)
                filteredInstances.push(filteredAddress)
                continue
            }
        }
    })

    return filteredInstances
}
